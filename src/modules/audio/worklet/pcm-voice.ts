import type { RenderReport, VoiceState } from "./protocol";

/** The narrow interface also lets clock/seek tests run without a browser audio device. */
export interface StretchProcessor {
	clear(): void;
	free(): void;
	setTempo(tempo: number): void;
	setPitch(pitch: number): void;
	setRate(rate: number): void;
	getInputChunkSize(): number;
	getInputPtr(channel: number): number;
	getOutputPtr(channel: number): number;
	processInput(frames: number): void;
	numSamples(): number;
	extractOutput(frames: number): number;
}

/**
 * SoundTouch's Spectral stretcher starts its output this far into its input:
 * 90 - 60 * tempo source milliseconds (60 ms at 0.5x, 30 ms at 1x), measured
 * with click trains through the vendored wasm and identical at 44.1/48 kHz.
 * Feeding from this much earlier makes the first output sample the seek frame,
 * so the frame clock and audition endpoints match what is heard.
 */
export function spectralLeadFrames(tempo: number, sampleRate: number) {
	return Math.round(((90 - 60 * tempo) / 1000) * sampleRate);
}

/**
 * Spectral also fades in over ~65 ms of output after every reset. This much
 * output is rendered and discarded first, so a seek or speed change starts at
 * full level instead of with a dip.
 */
const PREROLL_SECONDS = 0.08;

export function renderPcmBlock(
	voice: PcmVoice,
	output: Float32Array[],
	scratch: Float32Array[],
): RenderReport | null {
	for (const channel of output) channel.fill(0);
	let result: RenderReport | null = null;
	let offset = 0;
	while (offset < output[0].length) {
		const report = voice.render(scratch, 0);
		if (!report) break;
		result ??= { ...report, renderedFrames: 0 };
		for (let channel = 0; channel < output.length; channel++)
			output[channel].set(
				scratch[channel].subarray(0, report.renderedFrames),
				offset,
			);
		offset += report.renderedFrames;
		result.endFrame = report.endFrame;
		result.renderedFrames = offset;
		result.ended = report.ended;
		if (report.ended || report.renderedFrames === 0) break;
	}
	return result;
}

export class PcmVoice {
	private state: VoiceState;
	private appliedGeneration = -1;
	private position = 0;
	private readFrame = 0;
	private paddedFrames = 0;
	private renderedSinceSeek = 0;
	private processor: StretchProcessor | null = null;
	private inputChunk = 0;
	private discardFrames = 0;

	constructor(
		private channels: Float32Array[],
		private sampleRate: number,
		private memory: WebAssembly.Memory,
		private createProcessor: () => StretchProcessor,
	) {
		this.state = {
			generation: 0,
			frame: 0,
			endFrame: channels[0].length,
			playing: false,
			rate: 1,
			preservesPitch: true,
		};
	}

	setState(state: VoiceState) {
		if (state.generation <= this.state.generation) return;
		this.state = state;
	}

	destroy() {
		this.processor?.free();
		this.processor = null;
	}

	render(output: Float32Array[], contextTime: number): RenderReport | null {
		if (this.appliedGeneration !== this.state.generation) {
			this.processor?.clear();
			this.position = this.state.frame;
			this.readFrame = this.state.frame;
			this.paddedFrames = 0;
			this.renderedSinceSeek = 0;
			this.appliedGeneration = this.state.generation;
			if (this.state.preservesPitch && this.state.rate !== 1) {
				this.processor ??= this.createProcessor();
				this.processor.setTempo(this.state.rate);
				this.processor.setPitch(1);
				this.processor.setRate(1);
				this.inputChunk = this.processor.getInputChunkSize();
				if (this.inputChunk <= 0)
					throw new Error("Invalid SoundTouch input size");
				this.discardFrames = Math.round(PREROLL_SECONDS * this.sampleRate);
				this.readFrame -=
					spectralLeadFrames(this.state.rate, this.sampleRate) +
					Math.round(this.discardFrames * this.state.rate);
			}
		}
		for (const channel of output) channel.fill(0);
		if (!this.state.playing) return null;

		const startFrame = this.position;
		const end = Math.min(this.state.endFrame, this.channels[0].length);
		const allowed = Math.min(
			output[0].length,
			Math.max(
				0,
				Math.ceil(
					(end - this.state.frame) / this.state.rate - this.renderedSinceSeek,
				),
			),
		);
		let rendered = 0;
		if (allowed > 0) {
			if (
				this.state.preservesPitch &&
				this.state.rate !== 1 &&
				this.processor
			) {
				rendered = this.renderStretched(output, allowed, end);
			} else {
				for (let i = 0; i < allowed; i++) {
					const position = this.position + i * this.state.rate;
					// The last block can land on `end`; never read past the source.
					const index = Math.min(Math.floor(position), end - 1);
					const fraction = position - index;
					for (let c = 0; c < output.length; c++) {
						const source = this.channels[c];
						const next = Math.min(index + 1, end - 1);
						output[c][i] =
							source[index] + (source[next] - source[index]) * fraction;
					}
				}
				rendered = allowed;
			}
		}
		// Retain fractional source frames, and never count underrun silence.
		this.renderedSinceSeek += rendered;
		this.position = Math.min(
			end,
			this.state.frame + this.renderedSinceSeek * this.state.rate,
		);
		const ended = this.position >= end;
		if (ended) this.state = { ...this.state, playing: false };
		return {
			generation: this.appliedGeneration,
			startFrame,
			endFrame: this.position,
			contextTime,
			renderedFrames: rendered,
			ended,
		};
	}

	private renderStretched(
		output: Float32Array[],
		allowed: number,
		end: number,
	) {
		const processor = this.processor;
		if (!processor) return 0;
		while (this.discardFrames > 0) {
			const frames = Math.min(this.discardFrames, 128);
			this.feed(processor, frames, end);
			const dropped = processor.extractOutput(frames);
			// Nothing to drop yet: retry next block rather than stall the audio thread.
			if (dropped <= 0) return 0;
			this.discardFrames -= dropped;
		}
		this.feed(processor, allowed, end);
		const extracted = processor.extractOutput(allowed);
		for (let c = 0; c < output.length; c++) {
			output[c].set(
				new Float32Array(
					this.memory.buffer,
					processor.getOutputPtr(c),
					extracted,
				),
			);
		}
		return extracted;
	}

	private feed(processor: StretchProcessor, frames: number, end: number) {
		while (processor.numSamples() < frames) {
			const remaining = end - this.readFrame;
			const count =
				remaining > 0 ? Math.min(this.inputChunk, remaining) : this.inputChunk;
			// The wrapper has no flush API. Bounded zero padding drains delayed real audio;
			// extraction is still capped at the exact source endpoint, never at padded EOF.
			if (remaining <= 0) {
				this.paddedFrames += count;
				if (this.paddedFrames > this.sampleRate * 2) {
					throw new Error("SoundTouch failed to drain its output");
				}
			}
			// Priming for the stretch lead can start before the song: feed silence there.
			const silent = Math.max(0, Math.min(count, -this.readFrame));
			for (let c = 0; c < this.channels.length; c++) {
				const input = new Float32Array(
					this.memory.buffer,
					processor.getInputPtr(c),
					count,
				);
				if (remaining > 0) {
					input.fill(0, 0, silent);
					input.set(
						this.channels[c].subarray(
							this.readFrame + silent,
							this.readFrame + count,
						),
						silent,
					);
				} else input.fill(0);
			}
			processor.processInput(count);
			this.readFrame += Math.max(0, Math.min(count, remaining));
		}
	}
}
