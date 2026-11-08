import { describe, expect, it } from "vitest";
import {
	FREQUENCY_SCALE_CODES,
	FREQUENCY_SCALES,
	frequencyAtRatio,
	frequencyRulerLabels,
	isFrequencyScale,
	LOG_MIN_FREQUENCY,
	ratioAtFrequency,
	spectrogramTopFrequency,
} from "./frequency-scale";

const TOP = 20000;

describe("frequency scales", () => {
	it.each(FREQUENCY_SCALES)("%s round-trips and keeps the edges", (scale) => {
		expect(frequencyAtRatio(scale, 1, TOP)).toBeCloseTo(TOP, 6);
		for (const f of [100, 440, 1000, 4000, 12000]) {
			const ratio = ratioAtFrequency(scale, f, TOP);
			expect(frequencyAtRatio(scale, ratio, TOP)).toBeCloseTo(f, 6);
		}
	});

	it("gives voices far more room on log and mel than on linear", () => {
		const voiceShare = (scale: (typeof FREQUENCY_SCALES)[number]) =>
			ratioAtFrequency(scale, 4000, TOP) - ratioAtFrequency(scale, 80, TOP);
		expect(voiceShare("linear")).toBeLessThan(0.2);
		expect(voiceShare("log")).toBeGreaterThan(0.5);
		expect(voiceShare("mel")).toBeGreaterThan(0.4);
	});

	it("starts log at its minimum and linear and mel at 0 Hz", () => {
		expect(frequencyAtRatio("log", 0, TOP)).toBe(LOG_MIN_FREQUENCY);
		expect(frequencyAtRatio("linear", 0, TOP)).toBe(0);
		expect(frequencyAtRatio("mel", 0, TOP)).toBeCloseTo(0, 6);
	});

	it("rejects unknown stored values and has a renderer code for each scale", () => {
		expect(isFrequencyScale("mel")).toBe(true);
		expect(isFrequencyScale("bark")).toBe(false);
		expect(isFrequencyScale(undefined)).toBe(false);
		expect(FREQUENCY_SCALES.map((s) => FREQUENCY_SCALE_CODES[s])).toEqual([
			0, 1, 2,
		]);
	});
});

describe("spectrogramTopFrequency", () => {
	it("stops at the last whole bin under 20 kHz, like the renderer", () => {
		// 44.1 kHz, FFT 1024: 43.07 Hz bins, 464 of them.
		expect(spectrogramTopFrequency(44100, 1024)).toBeCloseTo(
			464 * (44100 / 1024),
			6,
		);
		expect(spectrogramTopFrequency(48000, 2048)).toBeCloseTo(
			853 * (48000 / 2048),
			6,
		);
	});

	it("stops at Nyquist for low sample rates", () => {
		expect(spectrogramTopFrequency(16000, 1024)).toBe(8000);
	});
});

describe("frequencyRulerLabels", () => {
	it("keeps the 20k label on linear and stays inside the range", () => {
		const top = spectrogramTopFrequency(44100, 1024);
		expect(frequencyRulerLabels("linear", top)[0]).toBe(20000);
		const labels = frequencyRulerLabels("log", 8000);
		expect(Math.max(...labels)).toBeLessThanOrEqual(8000);
		expect(labels).toEqual([...labels].sort((a, b) => b - a));
	});
});
