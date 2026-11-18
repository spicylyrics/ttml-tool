import { describe, expect, it } from "vitest";
import { clampZoom, minZoom } from "./zoom";

describe("spectrogram zoom range", () => {
	it("zooms out until a long song fits the view", () => {
		// 3 minutes in 1200 px.
		expect(minZoom(180, 1200)).toBeCloseTo(6.667, 3);
		expect(clampZoom(1, 180, 1200, 10000)).toBeCloseTo(6.667, 3);
		expect(180 * clampZoom(1, 180, 1200, 10000)).toBeCloseTo(1200);
	});

	it("keeps the old 50 px/s floor for songs that already fit", () => {
		expect(minZoom(10, 1200)).toBe(50);
		expect(clampZoom(20, 10, 1200, 10000)).toBe(50);
	});

	it("falls back to the old floor before the view is measured", () => {
		expect(minZoom(180, 0)).toBe(50);
		expect(minZoom(0, 1200)).toBe(50);
	});

	it("still caps zooming in", () => {
		expect(clampZoom(50000, 180, 1200, 10000)).toBe(10000);
	});
});
