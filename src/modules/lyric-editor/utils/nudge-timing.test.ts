import { describe, expect, it } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import {
	clampNudgeStep,
	nudgeLine,
	nudgeSelection,
	nudgeWordEnd,
	nudgeWordStart,
} from "./nudge-timing";

const word = (text: string, startTime: number, endTime: number) => ({
	...newLyricWord(),
	word: text,
	startTime,
	endTime,
});

const line = (...words: ReturnType<typeof word>[]): LyricLine => ({
	...newLyricLine(),
	words,
	startTime: Math.min(...words.map((w) => w.startTime)),
	endTime: Math.max(...words.map((w) => w.endTime)),
});

const times = (l: LyricLine) => l.words.map((w) => [w.startTime, w.endTime]);

describe("nudgeWordStart", () => {
	it("moves a touching previous word's end along", () => {
		const l = line(word("a", 1000, 2000), word("b", 2000, 3000));
		const result = nudgeWordStart(l, l.words[1].id, 10);
		expect(times(result)).toEqual([
			[1000, 2010],
			[2010, 3000],
		]);
	});

	it("leaves a gap or overlap with the previous word alone", () => {
		const l = line(word("a", 1000, 1500), word("b", 2000, 3000));
		const result = nudgeWordStart(l, l.words[1].id, -10);
		expect(times(result)).toEqual([
			[1000, 1500],
			[1990, 3000],
		]);
	});

	it("stops at the previous word's end when closing a gap", () => {
		const l = line(word("a", 1000, 1500), word("b", 1520, 3000));
		const closed = nudgeWordStart(l, l.words[1].id, -100);
		expect(times(closed)).toEqual([
			[1000, 1500],
			[1500, 3000],
		]);
		// Now connected, the next press moves the shared boundary.
		expect(times(nudgeWordStart(closed, l.words[1].id, -100))).toEqual([
			[1000, 1400],
			[1400, 3000],
		]);
	});

	it("moves freely inside an existing overlap", () => {
		const l = line(word("a", 1000, 2000), word("b", 1800, 3000));
		expect(nudgeWordStart(l, l.words[1].id, 100).words[1].startTime).toBe(1900);
	});

	it("moves the line start with its first word", () => {
		const l = line(word("a", 1000, 2000), word("b", 2000, 3000));
		expect(nudgeWordStart(l, l.words[0].id, -100).startTime).toBe(900);
		expect(nudgeWordStart(l, l.words[0].id, 100).startTime).toBe(1100);
	});

	it("keeps the start between the previous word's start and its own end", () => {
		const l = line(word("a", 1000, 2000), word("b", 2000, 3000));
		expect(nudgeWordStart(l, l.words[1].id, -5000).words[1].startTime).toBe(
			1010,
		);
		expect(nudgeWordStart(l, l.words[1].id, 5000).words[1].startTime).toBe(
			2990,
		);
		expect(nudgeWordStart(l, l.words[0].id, -5000).words[0].startTime).toBe(0);
	});

	it("skips spaces and untimed words when finding the previous word", () => {
		const l = line(
			word("a", 1000, 2000),
			word(" ", 0, 0),
			word("b", 2000, 3000),
		);
		const result = nudgeWordStart(l, l.words[2].id, 10);
		expect(result.words[0].endTime).toBe(2010);
		expect(result.words[1]).toBe(l.words[1]);
	});

	it("does nothing to an untimed word", () => {
		const l = line(word("a", 1000, 2000), word("b", 0, 0));
		expect(nudgeWordStart(l, l.words[1].id, 10)).toBe(l);
	});

	it("returns the same line when the clamp stops it", () => {
		const l = line(word("a", 0, 1000));
		expect(nudgeWordStart(l, l.words[0].id, -10)).toBe(l);
	});
});

describe("nudgeWordEnd", () => {
	it("moves the end into a gap and leaves the next word alone", () => {
		const l = line(word("a", 1000, 1500), word("b", 2000, 3000));
		const result = nudgeWordEnd(l, l.words[0].id, 100);
		expect(times(result)).toEqual([
			[1000, 1600],
			[2000, 3000],
		]);
	});

	it("stops at the next word's start when closing a gap", () => {
		const l = line(word("a", 1000, 1950), word("b", 2000, 3000));
		const closed = nudgeWordEnd(l, l.words[0].id, 100);
		expect(times(closed)).toEqual([
			[1000, 2000],
			[2000, 3000],
		]);
		expect(times(nudgeWordEnd(closed, l.words[0].id, 100))).toEqual([
			[1000, 2100],
			[2100, 3000],
		]);
	});

	it("moves a touching next word's start along", () => {
		const l = line(word("a", 1000, 2000), word("b", 2000, 3000));
		const result = nudgeWordEnd(l, l.words[0].id, -10);
		expect(times(result)).toEqual([
			[1000, 1990],
			[1990, 3000],
		]);
	});

	it("moves the line end with its last word", () => {
		const l = line(word("a", 1000, 2000), word("b", 2000, 3000));
		expect(nudgeWordEnd(l, l.words[1].id, 100).endTime).toBe(3100);
		expect(nudgeWordEnd(l, l.words[1].id, -100).endTime).toBe(2900);
	});

	it("keeps the end between its own start and the next word's end", () => {
		const l = line(word("a", 1000, 2000), word("b", 2000, 3000));
		expect(nudgeWordEnd(l, l.words[0].id, -5000).words[0].endTime).toBe(1010);
		expect(nudgeWordEnd(l, l.words[0].id, 5000).words[0].endTime).toBe(2990);
	});

	it("does nothing to an untimed word", () => {
		const l = line(word("a", 1000, 2000), word("b", 0, 0));
		expect(nudgeWordEnd(l, l.words[1].id, 10)).toBe(l);
	});
});

describe("nudgeLine", () => {
	it("moves the line and its timed words", () => {
		const l = line(word("a", 1000, 2000), word("b", 2000, 3000));
		const result = nudgeLine(l, 50);
		expect([result.startTime, result.endTime]).toEqual([1050, 3050]);
		expect(times(result)).toEqual([
			[1050, 2050],
			[2050, 3050],
		]);
	});

	it("stops at 0", () => {
		const l = line(word("a", 30, 1000));
		const result = nudgeLine(l, -100);
		expect([result.startTime, result.endTime]).toEqual([0, 970]);
	});

	it("leaves an untimed line alone", () => {
		const l = { ...newLyricLine(), words: [word("a", 0, 0)] };
		expect(nudgeLine(l, 10)).toBe(l);
	});
});

describe("nudgeSelection", () => {
	const doc = () => ({
		metadata: [],
		lyricLines: [
			line(word("a", 1000, 2000), word("b", 2000, 3000)),
			line(word("c", 4000, 5000)),
		],
	});

	it("moves selected words before selected lines", () => {
		const d = doc();
		const result = nudgeSelection(
			d,
			{
				lines: new Set([d.lyricLines[0].id]),
				words: new Set([d.lyricLines[0].words[1].id]),
			},
			10,
		);
		expect(times(result.lyricLines[0])).toEqual([
			[1000, 2010],
			[2010, 3000],
		]);
		expect(result.lyricLines[1]).toBe(d.lyricLines[1]);
	});

	it("moves selected lines when no word is selected", () => {
		const d = doc();
		const result = nudgeSelection(
			d,
			{ lines: new Set([d.lyricLines[1].id]), words: new Set() },
			-10,
		);
		expect(result.lyricLines[1].startTime).toBe(3990);
		expect(result.lyricLines[0]).toBe(d.lyricLines[0]);
	});

	it("moves selected words' ends, and nothing without a word", () => {
		const d = doc();
		const result = nudgeSelection(
			d,
			{ lines: new Set(), words: new Set([d.lyricLines[1].words[0].id]) },
			10,
			"end",
		);
		expect(result.lyricLines[1].words[0].endTime).toBe(5010);
		const linesOnly = {
			lines: new Set([d.lyricLines[0].id]),
			words: new Set<string>(),
		};
		expect(nudgeSelection(d, linesOnly, 10, "end")).toBe(d);
	});

	it("returns the same document when nothing moves", () => {
		const d = doc();
		expect(nudgeSelection(d, { lines: new Set(), words: new Set() }, 10)).toBe(
			d,
		);
	});
});

describe("clampNudgeStep", () => {
	it("rounds and keeps the step in range", () => {
		expect(clampNudgeStep(12.6)).toBe(13);
		expect(clampNudgeStep(0)).toBe(1);
		expect(clampNudgeStep(9000)).toBe(500);
		expect(clampNudgeStep(Number.NaN)).toBe(10);
	});
});
