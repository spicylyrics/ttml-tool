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
/**
 * No pointer update for 1.5 report intervals (within these bounds) means it's
 * held still. A crawling mouse moves a pixel at a time, often 100+ ms apart,
 * and a fixed short timeout faded the sound out between every pixel.
 */
const HOLD_SECONDS = 0.06;
const MAX_HOLD_SECONDS = 0.25;
/**
 * "Held" waits for 1.5x the longest gap in this much history. Going by the
 * last gap alone, uneven pixel steps (60 ms, then 200 ms) timed out inside the
 * long gap and chopped a slow drag into grains.
 */
const HISTORY_SECONDS = 0.6;
/** How gently the heard position is pulled onto the dragged one. */
const CORRECT_SECONDS = 0.15;
/** Faster pull once the pointer is held, so the sound lands on the playhead. */
const SETTLE_SECONDS = 0.04;
const MAX_RATE = 8;
/** Further behind the playhead than this, fade out and jump there instead. */
const JUMP_SECONDS = 0.25;
/** Fade in on grab and out on release or a jump, so none of them click. */
const FADE_SECONDS = 0.012;
/** Quiet below this many source frames per output frame, full from the next. */
const SILENT_SPEED = 0.02;
const FULL_SPEED = 0.25;

/**
 * Plays the song at a dragged playhead, rendered in the audio callback so it
 * answers the pointer within a block or two.
 *
 * The playback rate is the pointer's measured speed (from the input events'
 * own timestamps), smoothed, plus a gentle pull toward the dragged position.
 * Chasing each pointer step directly would make the rate spike after every
 * event and decay before the next, which tape mode turns into a warble. A
 * drag too fast or far to follow jumps instead of racing to catch up.
 *
 * It only sounds while the playhead moves, fading with speed. With pitch kept
 * (Signalsmith) speech stays at its own pitch; tape mode reads the song at the
 * drag speed, so the pitch follows the drag.
 */
export class ScrubVoice {
	private active = false;
	private preservesPitch = true;
	private target = 0;
	private position = 0;
	private gain = 0;
	private motionLevel = 0;
	private jumping = false;
	private speed = 0;
	private targetSpeed = 0;
	private lastTime = 0;
	private framesSinceInput = 0;
	private inputInterval = 0;
	/** Recent pointer reports, oldest first; `time` in ms. */
	private samples: { time: number; frame: number }[] = [];
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
			this.motionLevel = 0;
			this.jumping = false;
			this.speed = 0;
			this.targetSpeed = 0;
			this.inputInterval = 0;
			this.samples = [{ time: state.time, frame }];
			this.stretcher.reset(this.position, 0, length);
		} else if (state.active && state.time > this.lastTime) {
			// After a real pause, history from before it says nothing about this drag.
			if (state.time - this.lastTime > MAX_HOLD_SECONDS * 1000)
				this.samples = this.samples.slice(-1);
			const samples = this.samples;
			samples.push({ time: state.time, frame });
			// Keep the newest report from before the history as its start.
			while (
				samples.length > 2 &&
				samples[1].time <= state.time - HISTORY_SECONDS * 1000
			)
				samples.shift();
			const first = samples[samples.length - 2];
			const span = ((state.time - first.time) / 1000) * this.sampleRate;
			this.targetSpeed = Math.max(
				-MAX_RATE,
				Math.min(MAX_RATE, (frame - first.frame) / span),
			);
			// The longest gap between reports, ignoring real pauses.
			let gap = 0;
			for (let i = 1; i < samples.length; i++) {
				const seconds = (samples[i].time - samples[i - 1].time) / 1000;
				if (seconds <= MAX_HOLD_SECONDS) gap = Math.max(gap, seconds);
			}
			if (gap > 0) this.inputInterval = gap * this.sampleRate;
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
		const holdFrames = Math.max(
			HOLD_SECONDS * this.sampleRate,
			Math.min(MAX_HOLD_SECONDS * this.sampleRate, this.inputInterval * 1.5),
		);
		const held = this.framesSinceInput > holdFrames;
		if (held) this.targetSpeed = 0;
		const smoothing = 1 - Math.exp(-frames / (SPEED_SECONDS * this.sampleRate));
		this.speed += (this.targetSpeed - this.speed) * smoothing;
		// Smoothing the speed leaves the sound speed x SPEED_SECONDS behind the
		// pointer by design; pull only against error beyond that, so a steady
		// drag plays at exactly its speed. Once held, settle quickly onto it.
		const expectedLag = this.speed * SPEED_SECONDS * this.sampleRate;
		if (
			Math.abs(this.target - expectedLag - this.position) >
			JUMP_SECONDS * this.sampleRate
		)
			this.jumping = true;
		if (this.jumping && this.gain === 0) {
			// Faded out: land where the sound should be and fade back in.
			this.position = Math.max(0, Math.min(length, this.target - expectedLag));
			this.stretcher.reset(this.position, this.speed, length);
			this.jumping = false;
		}
		const pull =
			(this.target - expectedLag - this.position) /
			((held ? SETTLE_SECONDS : CORRECT_SECONDS) * this.sampleRate);
		const rate = Math.max(-MAX_RATE, Math.min(MAX_RATE, this.speed + pull));
		const next = Math.max(0, Math.min(length, this.position + rate * frames));
		const scratch =
			this.scratch[0].length >= frames
				? this.scratch
				: this.channels.map(() => new Float32Array(frames));

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
		}
		const levelFrom = this.motionLevel;
		const levelTo = Math.max(
			0,
			Math.min(
				1,
				(Math.abs(rate) - SILENT_SPEED) / (FULL_SPEED - SILENT_SPEED),
			),
		);
		this.motionLevel = levelTo;

		const fadeStep = frames / (FADE_SECONDS * this.sampleRate);
		const gainFrom = this.gain;
		const gainTo =
			this.active && !this.jumping
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
