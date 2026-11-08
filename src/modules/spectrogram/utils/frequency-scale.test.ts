import { describe, expect, it } from "vitest";
import {
	FREQUENCY_SCALES,
	frequencyAtRatio,
	frequencyRulerLabels,
	isFrequencyScale,
	LOG_MIN_FREQUENCY,
	ratioAtFrequency,
	remapSpectrogramRows,
} from "./frequency-scale";

const NYQUIST = 22050;

describe("frequency scales", () => {
	it.each(FREQUENCY_SCALES)("%s round-trips and keeps the edges", (scale) => {
		expect(frequencyAtRatio(scale, 1, NYQUIST)).toBeCloseTo(NYQUIST, 6);
		for (const f of [100, 440, 1000, 4000, 12000]) {
			const ratio = ratioAtFrequency(scale, f, NYQUIST);
			expect(frequencyAtRatio(scale, ratio, NYQUIST)).toBeCloseTo(f, 6);
		}
	});

	it("gives voices far more room on log and mel than on linear", () => {
		const voiceShare = (scale: (typeof FREQUENCY_SCALES)[number]) =>
			ratioAtFrequency(scale, 4000, NYQUIST) -
			ratioAtFrequency(scale, 80, NYQUIST);
		expect(voiceShare("linear")).toBeLessThan(0.2);
		expect(voiceShare("log")).toBeGreaterThan(0.5);
		expect(voiceShare("mel")).toBeGreaterThan(0.4);
	});

	it("starts log at its minimum and linear and mel at 0 Hz", () => {
		expect(frequencyAtRatio("log", 0, NYQUIST)).toBe(LOG_MIN_FREQUENCY);
		expect(frequencyAtRatio("linear", 0, NYQUIST)).toBe(0);
		expect(frequencyAtRatio("mel", 0, NYQUIST)).toBeCloseTo(0, 6);
	});

	it("rejects unknown stored values", () => {
		expect(isFrequencyScale("mel")).toBe(true);
		expect(isFrequencyScale("bark")).toBe(false);
		expect(isFrequencyScale(undefined)).toBe(false);
	});

	it("keeps ruler labels inside the range, top first", () => {
		const labels = frequencyRulerLabels("log", 8000);
		expect(Math.max(...labels)).toBeLessThanOrEqual(8000);
		expect(labels).toEqual([...labels].sort((a, b) => b - a));
	});
});

describe("remapSpectrogramRows", () => {
	// One pixel wide: each row's red channel holds its source row index.
	const source = (height: number) => {
		const data = new Uint8Array(height * 4);
		for (let y = 0; y < height; y++) data[y * 4] = y;
		return data;
	};

	it("is a no-op shape-wise for linear at the same height", () => {
		const out = remapSpectrogramRows(source(8), 1, 8, 8, "linear", NYQUIST);
		expect([...out].filter((_, i) => i % 4 === 0)).toEqual([
			0, 1, 2, 3, 4, 5, 6, 7,
		]);
	});

	it("pulls the bottom half of a log view from the lowest source rows", () => {
		const out = remapSpectrogramRows(source(200), 1, 200, 10, "log", NYQUIST);
		const rows = [...out].filter((_, i) => i % 4 === 0);
		// Bottom output row maps near 20 Hz, the last source row.
		expect(rows[9]).toBeGreaterThan(195);
		// The middle of a log axis is still well below 1 kHz, so deep in the
		// bottom of the linear source.
		expect(rows[5]).toBeGreaterThan(190);
		expect(rows).toEqual([...rows].sort((a, b) => a - b));
	});
});
