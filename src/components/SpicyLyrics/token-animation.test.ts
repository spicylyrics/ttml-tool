import { describe, expect, it } from "vitest";
import { wordGradientAt } from "./token-animation";

describe("wordGradientAt", () => {
	it("sweeps from -20% normally and from -50% in Simple Lyrics mode", () => {
		expect(wordGradientAt("not-sung", 0, false)).toBe(-20);
		expect(wordGradientAt("active", 0.5, false)).toBeCloseTo(40);
		expect(wordGradientAt("sung", 1, false)).toBe(100);
		expect(wordGradientAt("not-sung", 0, true)).toBe(-50);
		expect(wordGradientAt("active", 0, true)).toBe(-50);
		expect(wordGradientAt("active", 0.5, true)).toBeCloseTo(10);
		expect(wordGradientAt("sung", 1, true)).toBe(100);
	});

	it("follows the progress it is given, with no head start before the word", () => {
		// The old keyframe fill began at -27.5% after a prefill; Spicy dropped it.
		expect(wordGradientAt("active", 0.01, true)).toBeCloseTo(-48.8);
		expect(wordGradientAt("active", 0.99, true)).toBeCloseTo(68.8);
	});
});
