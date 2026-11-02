import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { hasTimingError } from "./line-presentation";

describe("line presentation", () => {
	it("flags inverted line and word times, but accepts equal and untimed times", () => {
		const line = newLyricLine();
		expect(hasTimingError(line)).toBe(false);
		expect(hasTimingError({ ...line, startTime: 200, endTime: 100 })).toBe(
			true,
		);
		expect(
			hasTimingError({
				...line,
				words: [{ ...newLyricWord(), startTime: 200, endTime: 100 }],
			}),
		).toBe(true);
		expect(hasTimingError({ ...line, startTime: 100, endTime: 100 })).toBe(
			false,
		);
	});
});
