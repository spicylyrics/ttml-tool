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

describe("scrub voice", () => {
	it("keeps sounding at the held spot with pitch kept", () => {
		const scrub = voice();
		scrub.set({ active: true, frame: sampleRate, preservesPitch: true });
		const heard = play(scrub, 0.4);
		const held = heard.subarray(sampleRate * 0.1);
		expect(rms(held)).toBeGreaterThan(0.08);
		expect(pitch(held)).toBeCloseTo(440, -1);
	});

	it.each([
		-2, -0.5, 0.5, 2,
	])("keeps the pitch while dragging at %sx", (speed) => {
		const scrub = voice();
		const start = sampleRate * 2;
		scrub.set({ active: true, frame: start, preservesPitch: true });
		const heard = play(scrub, 0.5, (time) =>
			scrub.set({
				active: true,
				frame: start + time * speed * sampleRate,
				preservesPitch: true,
			}),
		);
		const steady = heard.subarray(sampleRate * 0.15);
		expect(steady.every(Number.isFinite)).toBe(true);
		expect(pitch(steady)).toBeCloseTo(440, -1);
	});

	it("is silent while held in tape mode and plays the song at drag speed", () => {
		const scrub = voice();
		scrub.set({ active: true, frame: sampleRate, preservesPitch: false });
		expect(rms(play(scrub, 0.2).subarray(sampleRate * 0.05))).toBeLessThan(
			0.01,
		);
		const start = sampleRate;
		const heard = play(scrub, 0.5, (time) =>
			scrub.set({
				active: true,
				frame: start + time * sampleRate,
				preservesPitch: false,
			}),
		);
		const steady = heard.subarray(sampleRate * 0.2);
		expect(rms(steady)).toBeGreaterThan(0.3);
		expect(pitch(steady)).toBeCloseTo(440, -1);
	});

	it("fades out on release instead of cutting off", () => {
		const scrub = voice();
		scrub.set({ active: true, frame: sampleRate, preservesPitch: true });
		play(scrub, 0.2);
		scrub.set({ active: false, frame: sampleRate, preservesPitch: true });
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
		scrub.set({ active: true, frame: -5000, preservesPitch: false });
		play(scrub, 0.05);
		scrub.set({
			active: true,
			frame: tone.length + 5000,
			preservesPitch: false,
		});
		const heard = play(scrub, 0.3);
		expect(heard.every(Number.isFinite)).toBe(true);
	});
});
