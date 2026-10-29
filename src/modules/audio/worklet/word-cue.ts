import type { CueBoundary } from "../word-cues/model";
import type { RenderReport } from "./protocol";

function toneSample(
	age: number,
	frequency: number,
	sampleRate: number,
	duration: number,
) {
	return age < duration
		? Math.sin((2 * Math.PI * frequency * age) / sampleRate) *
				Math.min(1, age / (sampleRate * 0.002)) *
				(1 - age / duration) ** 2
		: 0;
}

/** Synthesized in the same output block as the music, with no main-thread timers. */
export class WordCueSynth {
	private boundaries: {
		frame: number;
		kind: "start" | "end" | "syllable";
		voice?: "duet" | "background";
	}[] = [];
	private ages = {
		start: Infinity,
		end: Infinity,
		syllable: Infinity,
		duet: Infinity,
		background: Infinity,
	};
	private last = {
		start: -Infinity,
		end: -Infinity,
		syllable: -Infinity,
		duet: -Infinity,
		background: -Infinity,
	};
	private volume = 0;
	constructor(private sampleRate: number) {}
	/**
	 * Boundaries are looked up per block from the music frame, so seeks and
	 * edits need no reset; a click already sounding finishes its short decay.
	 */
	configure(boundaries: CueBoundary[], volume: number) {
		this.boundaries = boundaries.map((b) => ({
			frame: (b.timeMs * this.sampleRate) / 1000,
			kind: b.kind,
			voice: b.voice,
		}));
		this.volume = Number.isFinite(volume)
			? Math.max(0, Math.min(1, volume))
			: 0;
	}
	render(
		output: Float32Array[],
		report: RenderReport | null,
		contextTime: number,
	) {
		if (!output[0]) return;
		if (this.volume === 0) {
			// Muting drops ringing clicks so they can't resume when unmuted.
			// Fixed assignments: muted blocks run constantly and must not allocate.
			this.ages.start = Infinity;
			this.ages.end = Infinity;
			this.ages.syllable = Infinity;
			this.ages.duet = Infinity;
			this.ages.background = Infinity;
			return;
		}
		let low = 0;
		let high = this.boundaries.length;
		const start = report?.startFrame ?? Infinity;
		while (low < high) {
			const mid = (low + high) >>> 1;
			if (this.boundaries[mid].frame < start) low = mid + 1;
			else high = mid;
		}
		const span = report ? report.endFrame - report.startFrame : 0;
		const duration = Math.round(this.sampleRate * 0.022);
		for (let i = 0; i < output[0].length; i++) {
			// Boundaries at the end of a block belong to the next block. EOF is
			// the exception: emit its end click on the final rendered sample.
			if (report && span > 0 && i < report.renderedFrames) {
				const limit = start + ((i + 1) * span) / report.renderedFrames;
				const atEnd = report.ended && i === report.renderedFrames - 1;
				while (
					low < this.boundaries.length &&
					(this.boundaries[low].frame < limit ||
						(atEnd && this.boundaries[low].frame <= limit))
				) {
					const { kind, voice } = this.boundaries[low++];
					const slot = voice ?? kind;
					const now = contextTime + i / this.sampleRate;
					// Coalesce repeated boundaries in dense/overlapping passages.
					if (now - this.last[slot] >= 0.035) {
						this.last[slot] = now;
						this.ages[slot] = 0;
					}
				}
			}
			// Fixed slots avoid per-sample allocations on the audio thread. The
			// 35ms retrigger guard is longer than each 22ms tone.
			const sample =
				(toneSample(this.ages.start++, 1200, this.sampleRate, duration) +
					toneSample(this.ages.syllable++, 950, this.sampleRate, duration) +
					toneSample(this.ages.end++, 650, this.sampleRate, duration) +
					toneSample(this.ages.background++, 480, this.sampleRate, duration) *
						0.22 +
					toneSample(this.ages.duet++, 1600, this.sampleRate, duration) *
						0.35) *
				this.volume *
				0.45;
			for (const channel of output) channel[i] += sample;
		}
	}
}
