import { describe, expect, it } from "vitest";
import { generatePalette, getInfernoColor } from "./colors";

const luminance = ([r, g, b]: [number, number, number]) =>
	0.2126 * r + 0.7152 * g + 0.0722 * b;

describe("getInfernoColor", () => {
	it("runs from near black to pale yellow", () => {
		expect(getInfernoColor(0)).toEqual([0, 0, 4]);
		expect(getInfernoColor(1)).toEqual([252, 255, 164]);
		expect(getInfernoColor(-1)).toEqual(getInfernoColor(0));
		expect(getInfernoColor(2)).toEqual(getInfernoColor(1));
	});

	it("gets brighter at every step, so loud bins stay distinct", () => {
		const levels = Array.from({ length: 256 }, (_, i) =>
			luminance(getInfernoColor(i / 255)),
		);
		for (let i = 1; i < levels.length; i++) {
			expect(levels[i]).toBeGreaterThan(levels[i - 1]);
		}
	});

	it("fills a 256-entry opaque lookup table", () => {
		const lut = generatePalette(getInfernoColor);
		expect(lut.length).toBe(256 * 4);
		expect(lut[255 * 4 + 3]).toBe(255);
	});
});
