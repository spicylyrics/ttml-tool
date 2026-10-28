import { describe, expect, it } from "vitest";
import { downmix, estimateBpm } from "./estimate-bpm";

const SAMPLE_RATE = 22050;

function clickTrack(bpm: number, seconds = 30, offset = 0.1): Float32Array {
	const out = new Float32Array(Math.floor(SAMPLE_RATE * seconds));
	const period = (60 / bpm) * SAMPLE_RATE;
	const clickLength = Math.floor(0.015 * SAMPLE_RATE);
	for (let t = offset * SAMPLE_RATE; t < out.length; t += period) {
		const start = Math.round(t);
		for (let i = 0; i < clickLength && start + i < out.length; i++) {
			const decay = Math.exp(-i / (0.003 * SAMPLE_RATE));
			out[start + i] +=
				0.8 * decay * Math.sin((2 * Math.PI * 1000 * i) / SAMPLE_RATE);
		}
	}
	return out;
}

function seededNoise(length: number, amplitude: number): Float32Array {
	let state = 12345;
	const out = new Float32Array(length);
	for (let i = 0; i < length; i++) {
		state = (Math.imul(state, 1103515245) + 12345) & 0x7fffffff;
		out[i] = amplitude * ((state / 0x7fffffff) * 2 - 1);
	}
	return out;
}

describe("estimateBpm", () => {
	it.each([90, 120, 150])("finds %i BPM in a click track", (bpm) => {
		const result = estimateBpm([clickTrack(bpm)], SAMPLE_RATE);
		expect(result).not.toBeNull();
		expect(Math.abs((result?.bpm ?? 0) - bpm)).toBeLessThanOrEqual(1);
		expect(result?.confidence).toBeGreaterThan(0.5);
	});

	it("handles stereo with a quiet second channel", () => {
		const left = clickTrack(128);
		const right = new Float32Array(left.length);
		const result = estimateBpm([left, right], SAMPLE_RATE);
		expect(Math.abs((result?.bpm ?? 0) - 128)).toBeLessThanOrEqual(1);
	});

	it("survives a little background noise", () => {
		const clicks = clickTrack(100);
		const noise = seededNoise(clicks.length, 0.02);
		const mixed = clicks.map((v, i) => v + noise[i]);
		const result = estimateBpm([mixed], SAMPLE_RATE);
		expect(Math.abs((result?.bpm ?? 0) - 100)).toBeLessThanOrEqual(1);
	});

	it("reports low confidence for noise", () => {
		const result = estimateBpm(
			[seededNoise(SAMPLE_RATE * 20, 0.5)],
			SAMPLE_RATE,
		);
		expect(result?.confidence ?? 0).toBeLessThan(0.3);
	});

	it("returns null for silence and audio too short to judge", () => {
		expect(
			estimateBpm([new Float32Array(SAMPLE_RATE * 10)], SAMPLE_RATE),
		).toBeNull();
		expect(estimateBpm([clickTrack(120, 1)], SAMPLE_RATE)).toBeNull();
		expect(estimateBpm([], SAMPLE_RATE)).toBeNull();
	});
});

describe("downmix", () => {
	it("averages channels", () => {
		const mono = downmix([
			Float32Array.from([1, 0, 0.5]),
			Float32Array.from([0, 1, 0.5]),
		]);
		expect(Array.from(mono)).toEqual([0.5, 0.5, 0.5]);
	});
});
