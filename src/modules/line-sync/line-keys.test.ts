import { describe, expect, it } from "vitest";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
} from "$/types/ttml";
import {
	findNextLineSyncIndex,
	lineSyncEnd,
	lineSyncNext,
	lineSyncStart,
} from "./line-keys";

const word = (text: string, startTime = 0, endTime = 0): LyricWord => ({
	...newLyricWord(),
	word: text,
	startTime,
	endTime,
});

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

describe("whole-line timing", () => {
	it("Start line sets the line's start and leaves its words alone", () => {
		const result = lineSyncStart(lines, 0, 1200);
		expect(result.nextIndex).toBe(-1);
		expect(result.lines[0].startTime).toBe(1200);
		expect(result.lines[0].words).toBe(lines[0].words);
		expect(result.lines[1]).toBe(lines[1]);
	});

	it("keeps a line stored as text timed like the line", () => {
		const block = line("lrc", {
			isLineSynced: true,
			startTime: 1000,
			endTime: 2000,
			words: [word("Whole line", 1000, 2000)],
		});
		const [moved] = lineSyncEnd([block], 0, 2600, "all").lines;
		expect(moved).toMatchObject({ startTime: 1000, endTime: 2600 });
		expect(moved.words[0]).toMatchObject({ startTime: 1000, endTime: 2600 });
	});

	it("End line and start next ends this line and starts the next one", () => {
		const started = lineSyncStart(lines, 0, 1000).lines;
		const result = lineSyncNext(started, 0, 3000, "all");
		expect(result.nextIndex).toBe(1);
		expect(result.lines[0]).toMatchObject({ startTime: 1000, endTime: 3000 });
		expect(result.lines[1].startTime).toBe(3000);
	});

	it("follows the background lane setting and skips lines without text", () => {
		const result = lineSyncNext(lines, 0, 3000, "same");
		expect(result.nextIndex).toBe(3);
		expect(result.lines[3].startTime).toBe(3000);
		expect(result.lines[1]).toBe(lines[1]);
	});

	it("End line ends the line and moves on without starting the next", () => {
		const result = lineSyncEnd(lines, 0, 2500, "same");
		expect(result.nextIndex).toBe(3);
		expect(result.lines[0].endTime).toBe(2500);
		expect(result.lines[3]).toBe(lines[3]);
	});

	it("on the last line just ends it", () => {
		const result = lineSyncNext(lines, 3, 9000, "all");
		expect(result.nextIndex).toBe(-1);
		expect(result.lines[3].endTime).toBe(9000);
	});

	it("finds the next synchronizable line in the lane", () => {
		expect(findNextLineSyncIndex(lines, 0, "all")).toBe(1);
		expect(findNextLineSyncIndex(lines, 0, "same")).toBe(3);
		expect(findNextLineSyncIndex(lines, 3, "all")).toBe(-1);
	});
});
