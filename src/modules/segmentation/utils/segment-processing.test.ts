import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { processSingleLine } from "./segment-processing";

describe("live timeline bounds", () => {
	it("starts an untimed line at its first completed word, not 0:00", () => {
		const line = {
			...newLyricLine(),
			words: [
				{ ...newLyricWord(), word: "done", startTime: 5000, endTime: 5500 },
				{ ...newLyricWord(), word: "pending", startTime: 5500 },
			],
		};
		const processed = processSingleLine(line);
		expect(processed).toMatchObject({ startTime: 5000, endTime: 5500 });
		expect(processed.segments).toEqual([{ ...line.words[0], type: "word" }]);
		expect(line).toMatchObject({ startTime: 0, endTime: 0 });
	});

	it.each([
		{ startTime: 0, endTime: 6000 },
		{ startTime: 4000, endTime: 0 },
	])("keeps an explicit leading gap at $startTime", (timing) => {
		const line = {
			...newLyricLine(),
			...timing,
			words: [
				{ ...newLyricWord(), word: "done", startTime: 5000, endTime: 5500 },
			],
		};
		const processed = processSingleLine(line);
		expect(processed.startTime).toBe(timing.startTime);
		expect(processed.segments[0]).toMatchObject({
			type: "gap",
			startTime: timing.startTime,
			endTime: 5000,
		});
	});

	it("shows a finished span before the line has an end time", () => {
		const line = {
			...newLyricLine(),
			startTime: 1000,
			words: [
				{ ...newLyricWord(), word: "hel", startTime: 1000, endTime: 1300 },
				{ ...newLyricWord(), word: "lo", startTime: 1300 },
			],
		};
		const processed = processSingleLine(line);
		expect(processed).toMatchObject({ startTime: 1000, endTime: 1300 });
		expect(processed.segments).toEqual([{ ...line.words[0], type: "word" }]);
		expect(line.endTime).toBe(0);
	});

	it("includes completed words outside stale line bounds when retiming", () => {
		const line = {
			...newLyricLine(),
			startTime: 1000,
			endTime: 2000,
			words: [
				{ ...newLyricWord(), word: "first", startTime: 500, endTime: 1500 },
				{ ...newLyricWord(), word: "next", startTime: 1500, endTime: 3000 },
			],
		};
		expect(processSingleLine(line)).toMatchObject({
			startTime: 500,
			endTime: 3000,
		});
		expect(line).toMatchObject({ startTime: 1000, endTime: 2000 });
	});

	it("preserves completed line bounds and leading/trailing gaps", () => {
		const line = {
			...newLyricLine(),
			startTime: 1000,
			endTime: 4000,
			words: [
				{ ...newLyricWord(), word: "word", startTime: 2000, endTime: 3000 },
			],
		};
		const processed = processSingleLine(line);
		expect(processed).toMatchObject({ startTime: 1000, endTime: 4000 });
		expect(
			processed.segments.map(({ type, startTime, endTime }) => [
				type,
				startTime,
				endTime,
			]),
		).toEqual([
			["gap", 1000, 2000],
			["word", 2000, 3000],
			["gap", 3000, 4000],
		]);
	});

	it("does not extend the line for unfinished or zero-duration spans", () => {
		const line = {
			...newLyricLine(),
			words: [
				{ ...newLyricWord(), startTime: 5000 },
				{ ...newLyricWord(), startTime: 6000, endTime: 6000 },
			],
		};
		expect(processSingleLine(line)).toMatchObject({
			startTime: 0,
			endTime: 0,
			segments: [],
		});
	});

	it("flags a line whose current word has a start but no end", () => {
		const syncing = {
			...newLyricLine(),
			words: [
				{ ...newLyricWord(), word: "hel", startTime: 1000, endTime: 1300 },
				{ ...newLyricWord(), word: "lo", startTime: 1300 },
			],
		};
		const done = {
			...syncing,
			words: [syncing.words[0], { ...syncing.words[1], endTime: 1600 }],
		};
		expect(processSingleLine(syncing).syncInProgress).toBe(true);
		expect(processSingleLine(done).syncInProgress).toBe(false);
	});
});
