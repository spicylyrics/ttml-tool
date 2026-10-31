import { describe, expect, it } from "vitest";
import { type LyricWord, newLyricWord } from "$/types/ttml";
import { combineWithNeighbor, getNeighborRange } from "./combine-neighbors";

const word = (text: string, startTime: number, endTime: number): LyricWord => ({
	...newLyricWord(),
	word: text,
	startTime,
	endTime,
});

const times = (words: LyricWord[]) =>
	words.map((w) => [w.word, w.startTime, w.endTime]);

describe("combineWithNeighbor", () => {
	const line = () => [
		word("beau", 1000, 1200),
		word("ti", 1200, 1350),
		word("ful", 1400, 1800),
		word(" ", 0, 0),
		word("day", 2000, 2500),
	];

	it("takes the first start and the last end", () => {
		const result = combineWithNeighbor(line(), 0, "next");
		expect(result && times(result.words)).toEqual([
			["beauti", 1000, 1350],
			["ful", 1400, 1800],
			[" ", 0, 0],
			["day", 2000, 2500],
		]);
	});

	it("combines with the previous word", () => {
		const result = combineWithNeighbor(line(), 2, "previous");
		expect(result && times(result.words)).toEqual([
			["beau", 1000, 1200],
			["tiful", 1200, 1800],
			[" ", 0, 0],
			["day", 2000, 2500],
		]);
		expect(result?.combined.word).toBe("tiful");
	});

	it("merges blank words between the two neighbors", () => {
		const result = combineWithNeighbor(line(), 2, "next");
		expect(result && times(result.words)).toEqual([
			["beau", 1000, 1200],
			["ti", 1200, 1350],
			["ful day", 1400, 2500],
		]);
	});

	it("keeps the timed word's range when the next word is untimed", () => {
		const words = [word("beau", 1000, 1200), word("ti", 0, 0)];
		const result = combineWithNeighbor(words, 0, "next");
		expect(result && times(result.words)).toEqual([["beauti", 1000, 1200]]);
	});

	it("keeps the timed word's range when the previous word is untimed", () => {
		const words = [word("beau", 0, 0), word("ti", 1200, 1350)];
		const result = combineWithNeighbor(words, 1, "previous");
		expect(result && times(result.words)).toEqual([["beauti", 1200, 1350]]);
	});

	it("never ends before it starts when a word has a start but no end yet", () => {
		const words = [word("ti", 1000, 1500), word("ful", 1500, 0)];
		const result = combineWithNeighbor(words, 0, "next");
		expect(result && times(result.words)).toEqual([["tiful", 1000, 1500]]);
		const open = [word("ful", 1500, 0), word("day", 0, 0)];
		const second = combineWithNeighbor(open, 0, "next");
		expect(second && times(second.words)).toEqual([["fulday", 1500, 1500]]);
	});

	it("leaves two untimed words untimed", () => {
		const words = [word("beau", 0, 0), word("ti", 0, 0)];
		const result = combineWithNeighbor(words, 0, "next");
		expect(result && times(result.words)).toEqual([["beauti", 0, 0]]);
	});

	it("returns null at the edges of the line", () => {
		expect(combineWithNeighbor(line(), 0, "previous")).toBeNull();
		expect(combineWithNeighbor(line(), 4, "next")).toBeNull();
		expect(getNeighborRange(line(), 9, "next")).toBeNull();
	});

	it("does not mutate the input", () => {
		const words = line();
		const before = times(words);
		combineWithNeighbor(words, 0, "next");
		expect(times(words)).toEqual(before);
	});
});
