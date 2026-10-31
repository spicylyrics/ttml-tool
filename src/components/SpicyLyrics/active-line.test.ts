import { describe, expect, it } from "vitest";
import { findSpicyActiveIndex, findSpicyScrollIndex } from "./active-line";

describe("Spicy active scroll anchor", () => {
	it("preserves the first anchor for adjacent duet lines", () => {
		expect(
			findSpicyActiveIndex(
				[
					{ startTime: 100, endTime: 500 },
					{ startTime: 100, endTime: 500 },
				],
				200,
			),
		).toBe(0);
	});
	it("uses the last anchor when overlapping lines are separated", () => {
		expect(
			findSpicyActiveIndex(
				[
					{ startTime: 100, endTime: 500 },
					{ startTime: 600, endTime: 700 },
					{ startTime: 100, endTime: 500 },
				],
				200,
			),
		).toBe(2);
	});
	it("keeps end-of-song anchoring, gaps and empty lyrics", () => {
		const lines = [
			{ startTime: 100, endTime: 200 },
			{ startTime: 400, endTime: 500 },
		];
		expect(findSpicyScrollIndex(lines, 0)).toBe(-1);
		expect(findSpicyScrollIndex(lines, 300)).toBe(-1);
		expect(findSpicyScrollIndex(lines, 500)).toBe(1);
		expect(findSpicyScrollIndex([], 0)).toBe(-1);
	});
	it("never scrolls to an untimed row", () => {
		const untimed = { startTime: 0, endTime: 0, isUntimed: true };
		// A song with nothing synced stays where it is.
		expect(findSpicyScrollIndex([untimed, untimed], 0)).toBe(-1);
		// Past the last synced line, rest on it, not on the untimed tail.
		const lines = [
			{ startTime: 100, endTime: 200 },
			{ ...untimed, startTime: 200, endTime: 200 },
			{ ...untimed, startTime: 200, endTime: 200 },
		];
		expect(findSpicyScrollIndex(lines, 0)).toBe(-1);
		expect(findSpicyScrollIndex(lines, 150)).toBe(0);
		expect(findSpicyScrollIndex(lines, 300)).toBe(0);
	});
});
