import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { ScrubVoice } from "./scrub-voice";
import { SignalsmithStretcher } from "./signalsmith";

const sampleRate = 44100;
const module = new WebAssembly.Module(
	readFileSync("src/modules/audio/worklet/vendor/signalsmith-stretch.wasm"),
);
const tone = Float32Array.from(
	{ length: sampleRate * 4 },
	(_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sampleRate),
);

function voice(source = tone) {
	return new ScrubVoice(
		[source],
		sampleRate,
		new SignalsmithStretcher(module, [source], sampleRate),
	);
}

/** Renders `seconds` of 128-frame blocks, calling `drag` before each block. */
function play(
	scrub: ScrubVoice,
	seconds: number,
	drag?: (time: number) => void,
) {
	const heard: number[] = [];
	const blocks = Math.round((seconds * sampleRate) / 128);
	for (let block = 0; block < blocks; block++) {
		drag?.((block * 128) / sampleRate);
		const output = [new Float32Array(128)];
		scrub.render(output);
		heard.push(...output[0]);
	}
	return Float32Array.from(heard);
}

const rms = (samples: Float32Array) =>
	Math.sqrt(samples.reduce((sum, v) => sum + v * v, 0) / samples.length);

function pitch(samples: Float32Array) {
	let crossings = 0;
	for (let i = 1; i < samples.length; i++)
		if (samples[i - 1] < 0 !== samples[i] < 0) crossings++;
	return crossings / 2 / (samples.length / sampleRate);
}

/** A pointer reporting every `interval` seconds while moving at `speed`. */
function pointer(
	scrub: ScrubVoice,
	start: number,
	speed: number,
	preservesPitch: boolean,
	interval = 0,
) {
	let last = -Infinity;
	return (time: number) => {
		if (time - last < interval) return;
		last = time;
		scrub.set({
			active: true,
			frame: start + time * speed * sampleRate,
			preservesPitch,
			time: time * 1000,
		});
	};
}

describe("scrub voice", () => {
	it.each([
		true,
		false,
	])("jumps after a far fling instead of racing to catch up (pitch kept: %s)", (preservesPitch) => {
		const long = Float32Array.from(
			{ length: sampleRate * 40 },
			(_, i) => 0.5 * Math.sin((2 * Math.PI * 440 * i) / sampleRate),
		);
		const scrub = voice(long);
		scrub.set({ active: true, frame: sampleRate, preservesPitch, time: 0 });
		play(scrub, 0.05);
		scrub.set({
			active: true,
			frame: sampleRate * 30,
			preservesPitch,
			time: 66,
		});
		const after = play(scrub, 1);
		expect(after.every(Number.isFinite)).toBe(true);
		// Racing 29 s at the 8x cap would still be sounding for seconds.
		expect(rms(after.subarray(sampleRate * 0.4))).toBeLessThan(0.01);
	});

	it("goes silent while held with pitch kept", () => {
		const scrub = voice();
		const moving = play(scrub, 0.3, pointer(scrub, sampleRate, 1, true, 0.016));
		expect(rms(moving.subarray(sampleRate * 0.15))).toBeGreaterThan(0.2);
		const held = play(scrub, 0.4).subarray(sampleRate * 0.25);
		expect(rms(held)).toBeLessThan(0.01);
	});

	it.each([
		-2, -0.5, 0.5, 2,
	])("keeps the pitch while dragging at %sx", (speed) => {
		const scrub = voice();
		const start = sampleRate * 2;
		const heard = play(scrub, 0.5, pointer(scrub, start, speed, true));
		const steady = heard.subarray(sampleRate * 0.15);
		expect(steady.every(Number.isFinite)).toBe(true);
		expect(pitch(steady)).toBeCloseTo(440, -1);
	});

	it("is silent while held in tape mode and plays the song at drag speed", () => {
		const scrub = voice();
		scrub.set({
			active: true,
			frame: sampleRate,
			preservesPitch: false,
			time: 0,
		});
		expect(rms(play(scrub, 0.2).subarray(sampleRate * 0.05))).toBeLessThan(
			0.01,
		);
		const heard = play(scrub, 0.5, (time) =>
			scrub.set({
				active: true,
				frame: sampleRate + time * sampleRate,
				preservesPitch: false,
				time: 200 + time * 1000,
			}),
		);
		const steady = heard.subarray(sampleRate * 0.2);
		expect(rms(steady)).toBeGreaterThan(0.3);
		expect(pitch(steady)).toBeCloseTo(440, -1);
	});

	it.each([
		0.008, 0.016,
	])("holds a steady tape pitch for a 1x drag reported every %ss", (interval) => {
		// A mouse moves the playhead in steps. Chasing each step made the rate
		// spike and decay between events, which warbled the pitch.
		const scrub = voice();
		const heard = play(
			scrub,
			1,
			pointer(scrub, sampleRate, 1, false, interval),
		);
		const window = Math.round(sampleRate * 0.025);
		for (
			let from = sampleRate * 0.3;
			from + window < heard.length;
			from += window
		) {
			const hz = pitch(heard.subarray(from, from + window));
			expect(hz, `at ${(from / sampleRate).toFixed(3)}s`).toBeGreaterThan(400);
			expect(hz, `at ${(from / sampleRate).toFixed(3)}s`).toBeLessThan(480);
		}
	});

	it.each([
		true,
		false,
	])("keeps sounding through a slow pixel-by-pixel drag (pitch kept: %s)", (preservesPitch) => {
		// 0.15x with a report every 120 ms: one pixel at a time on a slow drag.
		// It used to fade to nothing between pixels. (Kept pitch wobbles in level
		// this slow on a pure tone, the library's own variation, so the check is
		// "never drops out" rather than "steady".)
		const floor = preservesPitch ? 0.02 : 0.1;
		const scrub = voice();
		const heard = play(
			scrub,
			1.5,
			pointer(scrub, sampleRate, 0.15, preservesPitch, 0.12),
		);
		const window = Math.round(sampleRate * 0.025);
		for (
			let from = sampleRate * 0.4;
			from + window < heard.length;
			from += window
		)
			expect(
				rms(heard.subarray(from, from + window)),
				`at ${(from / sampleRate).toFixed(3)}s`,
			).toBeGreaterThan(floor);
	});

	it("goes quiet when the pointer stops in tape mode", () => {
		const scrub = voice();
		const move = pointer(scrub, sampleRate, 1, false, 0.016);
		play(scrub, 0.4, move);
		const stopped = play(scrub, 0.4).subarray(sampleRate * 0.25);
		expect(rms(stopped)).toBeLessThan(0.02);
	});

	it("fades out on release instead of cutting off", () => {
		const scrub = voice();
		play(scrub, 0.2, pointer(scrub, sampleRate, 1, true));
		scrub.set({
			active: false,
			frame: sampleRate * 1.2,
			preservesPitch: true,
			time: 200,
		});
		const tail = play(scrub, 0.05);
		// No jump to silence in the first block, nothing left after the fade.
		expect(Math.max(...tail.subarray(0, 64).map(Math.abs))).toBeGreaterThan(
			0.05,
		);
		expect(scrub.audible).toBe(false);
		expect(rms(tail.subarray(sampleRate * 0.02))).toBe(0);
	});

	it("stays inside the song when dragged past either end", () => {
		const scrub = voice();
		scrub.set({ active: true, frame: -5000, preservesPitch: false, time: 0 });
		play(scrub, 0.05);
		scrub.set({
			active: true,
			frame: tone.length + 5000,
			preservesPitch: false,
			time: 50,
		});
		const heard = play(scrub, 0.3);
		expect(heard.every(Number.isFinite)).toBe(true);
	});
});
