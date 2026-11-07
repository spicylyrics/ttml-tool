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

/** Smoothing of the measured pointer speed, which becomes the playback rate. */
const SPEED_SECONDS = 0.05;
/** No pointer update for this long means it's being held still. */
const HOLD_SECONDS = 0.06;
/** How gently the heard position is pulled onto the dragged one. */
const CORRECT_SECONDS = 0.15;
/** Faster pull once the pointer is held, so the sound lands on the playhead. */
const SETTLE_SECONDS = 0.04;
const MAX_RATE = 8;
/** Fade in on grab and out on release, so neither clicks. */
const FADE_SECONDS = 0.012;
/** Tape mode goes quiet below this many source frames per output frame. */
const TAPE_SILENT_SPEED = 0.02;
const TAPE_FULL_SPEED = 0.25;

/**
 * Plays the song at a dragged playhead, rendered in the audio callback so it
 * answers the pointer within a block or two.
 *
 * The playback rate is the pointer's measured speed (from the input events'
 * own timestamps), smoothed, plus a gentle pull toward the dragged position.
 * Chasing each pointer step directly would make the rate spike after every
 * event and decay before the next, which tape mode turns into a warble.
 *
 * With pitch kept (Signalsmith) the spot under the playhead keeps sounding
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
	private speed = 0;
	private targetSpeed = 0;
	private lastTime = 0;
	private framesSinceInput = 0;
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
			this.speed = 0;
			this.targetSpeed = 0;
			this.stretcher.reset(this.position, 0, length);
		} else if (state.active && state.time > this.lastTime) {
			const elapsed = ((state.time - this.lastTime) / 1000) * this.sampleRate;
			this.targetSpeed = Math.max(
				-MAX_RATE,
				Math.min(MAX_RATE, (frame - this.target) / elapsed),
			);
		}
		if (state.active) {
			this.lastTime = state.time;
			this.framesSinceInput = 0;
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
		this.framesSinceInput += frames;
		const held = this.framesSinceInput > HOLD_SECONDS * this.sampleRate;
		if (held) this.targetSpeed = 0;
		const smoothing = 1 - Math.exp(-frames / (SPEED_SECONDS * this.sampleRate));
		this.speed += (this.targetSpeed - this.speed) * smoothing;
		// Smoothing the speed leaves the sound speed x SPEED_SECONDS behind the
		// pointer by design; pull only against error beyond that, so a steady
		// drag plays at exactly its speed. Once held, settle quickly onto it.
		const expectedLag = this.speed * SPEED_SECONDS * this.sampleRate;
		const pull =
			(this.target - expectedLag - this.position) /
			((held ? SETTLE_SECONDS : CORRECT_SECONDS) * this.sampleRate);
		const rate = Math.max(-MAX_RATE, Math.min(MAX_RATE, this.speed + pull));
		const next = Math.max(0, Math.min(length, this.position + rate * frames));
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
