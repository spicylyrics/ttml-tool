import { describe, expect, it } from "vitest";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
} from "$/types/ttml";
import {
	findNextLineSyncIndex,
	findPrevLineSyncIndex,
	lineSyncEnd,
	lineSyncNext,
	lineSyncStart,
} from "./line-keys";

const word = (text: string): LyricWord => ({ ...newLyricWord(), word: text });

const line = (id: string, extra: Partial<LyricLine> = {}): LyricLine => ({
	...newLyricLine(),
	id,
	words: [word(id), word(" "), word("la")],
	...extra,
});

const lines = [
	line("a"),
	line("bg", { isBG: true }),
	line("empty", { words: [word(" ")] }),
	line("b"),
];

describe("Line-mode F/G/H", () => {
	it("F starts the line and gives its words the line's time", () => {
		const result = lineSyncStart(lines, 0, 1200);
		expect(result.nextIndex).toBe(-1);
		expect(result.lines[0]).toMatchObject({
			startTime: 1200,
			isLineSynced: true,
		});
		expect(result.lines[0].words[0].startTime).toBe(1200);
		expect(result.lines[0].words[1].startTime).toBe(0);
		expect(result.lines[1]).toBe(lines[1]);
	});

	it("G ends the line and starts the next one at the same time", () => {
		const started = lineSyncStart(lines, 0, 1000).lines;
		const result = lineSyncNext(started, 0, 3000, "all");
		expect(result.nextIndex).toBe(1);
		expect(result.lines[0]).toMatchObject({
			startTime: 1000,
			endTime: 3000,
			lineBoundsSynced: true,
		});
		expect(result.lines[0].words[2]).toMatchObject({
			startTime: 1000,
			endTime: 3000,
		});
		expect(result.lines[1].startTime).toBe(3000);
	});

	it("G follows the background lane setting and skips lines without text", () => {
		const result = lineSyncNext(lines, 0, 3000, "same");
		expect(result.nextIndex).toBe(3);
		expect(result.lines[3].startTime).toBe(3000);
		expect(result.lines[1]).toBe(lines[1]);
	});

	it("H ends the line and moves on without starting the next", () => {
		const result = lineSyncEnd(lines, 0, 2500, "same");
		expect(result.nextIndex).toBe(3);
		expect(result.lines[0].endTime).toBe(2500);
		expect(result.lines[3]).toBe(lines[3]);
	});

	it("G on the last line just ends it", () => {
		const result = lineSyncNext(lines, 3, 9000, "all");
		expect(result.nextIndex).toBe(-1);
		expect(result.lines[3].endTime).toBe(9000);
	});
});

describe("line navigation", () => {
	it("moves by synchronizable lines in the lane", () => {
		expect(findNextLineSyncIndex(lines, 0, "all")).toBe(1);
		expect(findNextLineSyncIndex(lines, 0, "same")).toBe(3);
		expect(findPrevLineSyncIndex(lines, 3, "all")).toBe(1);
		expect(findPrevLineSyncIndex(lines, 3, "same")).toBe(0);
		expect(findPrevLineSyncIndex(lines, 0, "all")).toBe(-1);
	});
});
