import type { ScrubState } from "./protocol";

/** Renders straight from a source position; Signalsmith in the app. */
export interface PositionalStretcher {
	reset(position: number, rate: number, end: number): void;
	render(
		position: number,
		rate: number,
		end: number,
		output: Float32Array[],
		frames: number,
	): void;
}

/** How quickly the heard position catches up with the dragged one. */
const FOLLOW_SECONDS = 0.035;
/** Fade in on grab and out on release, so neither clicks. */
const FADE_SECONDS = 0.012;
/** Tape mode goes quiet below this many source frames per output frame. */
const TAPE_SILENT_SPEED = 0.02;
const TAPE_FULL_SPEED = 0.25;

/**
 * Plays the song at a dragged playhead, rendered in the audio callback so it
 * answers the pointer within a block or two. The heard position glides toward
 * the latest drag position, and the glide speed becomes the playback rate:
 * with pitch kept (Signalsmith) the spot under the playhead keeps sounding
 * while the pointer holds still; tape mode reads the song at that speed, so
 * pitch follows the drag and it goes silent when the pointer stops.
 */
export class ScrubVoice {
	private active = false;
	private preservesPitch = true;
	private target = 0;
	private position = 0;
	private gain = 0;
	private tapeLevel = 0;
	private readonly scratch: Float32Array[];

	constructor(
		private readonly channels: Float32Array[],
		private readonly sampleRate: number,
		private readonly stretcher: PositionalStretcher,
	) {
		this.scratch = channels.map(() => new Float32Array(128));
	}

	get audible() {
		return this.active || this.gain > 0;
	}

	set(state: ScrubState) {
		const length = this.channels[0].length;
		const frame = Math.max(0, Math.min(length, state.frame));
		if (state.active && !this.active) {
			// A fresh grab starts at the pointer; a quick re-grab while still fading
			// out keeps gliding from where the sound is.
			if (this.gain === 0) this.position = frame;
			this.tapeLevel = 0;
			this.stretcher.reset(this.position, 0, length);
		}
		this.active = state.active;
		this.preservesPitch = state.preservesPitch;
		this.target = frame;
	}

	/** Adds this block of scrub audio to `output`. */
	render(output: Float32Array[]) {
		if (!this.audible) return;
		const frames = output[0].length;
		const length = this.channels[0].length;
		const follow = 1 - Math.exp(-frames / (FOLLOW_SECONDS * this.sampleRate));
		const next = this.position + (this.target - this.position) * follow;
		const rate = (next - this.position) / frames;
		const scratch =
			this.scratch[0].length >= frames
				? this.scratch
				: this.channels.map(() => new Float32Array(frames));

		let levelFrom = 1;
		let levelTo = 1;
		if (this.preservesPitch) {
			this.stretcher.render(this.position, rate, length, scratch, frames);
		} else {
			for (let i = 0; i < frames; i++) {
				const at = Math.max(0, Math.min(length - 1, this.position + i * rate));
				const index = Math.floor(at);
				const next = Math.min(index + 1, length - 1);
				const fraction = at - index;
				for (let c = 0; c < this.channels.length; c++) {
					const source = this.channels[c];
					scratch[c][i] =
						source[index] + (source[next] - source[index]) * fraction;
				}
			}
			const speed = Math.abs(rate);
			levelFrom = this.tapeLevel;
			levelTo = Math.max(
				0,
				Math.min(
					1,
					(speed - TAPE_SILENT_SPEED) / (TAPE_FULL_SPEED - TAPE_SILENT_SPEED),
				),
			);
			this.tapeLevel = levelTo;
		}

		const fadeStep = frames / (FADE_SECONDS * this.sampleRate);
		const gainFrom = this.gain;
		const gainTo = this.active
			? Math.min(1, gainFrom + fadeStep)
			: Math.max(0, gainFrom - fadeStep);
		for (let i = 0; i < frames; i++) {
			const t = (i + 1) / frames;
			const level =
				(gainFrom + (gainTo - gainFrom) * t) *
				(levelFrom + (levelTo - levelFrom) * t);
			for (let c = 0; c < output.length; c++)
				output[c][i] += scratch[c % scratch.length][i] * level;
		}
		this.gain = gainTo;
		this.position = next;
	}
}
