import { describe, expect, it } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import type { SegmentationConfig, UnsureSplitMode } from "../types";
import { segmentWord } from "./segmentation";
import { isUnsureSplit } from "./syllabification-engines";
import { clearUnsureSplits, findUnsureSplitWords } from "./unsure-splits";

const config = (unsureSplits?: UnsureSplitMode): SegmentationConfig => ({
	engine: "prosodic",
	splitCJK: true,
	splitEnglish: true,
	punctuationWeight: 0.2,
	punctuationMode: "merge",
	removeEmptySegments: true,
	ignoreList: new Set(),
	customRules: new Map(),
	learnedRules: new Map(),
	unsureSplits,
});

const split = (word: string, mode?: UnsureSplitMode) =>
	segmentWord({ ...newLyricWord(), word, endTime: 1000 }, config(mode));

describe("unsure splits", () => {
	it.each([
		[["Balen", "ci", "a", "ga"], true],
		[["his", "tory"], true],
		[["li", "on"], true],
		[["wo", "ah"], true],
		[["ba", "by"], false],
		[["go", "in'"], false],
		[["did", "n't"], false],
		[["some", "one"], false],
		[["sex", "y"], false],
		[["D", "J"], false],
		[["love"], false],
	])("flags %j: %s", (parts, unsure) => {
		expect(isUnsureSplit(parts)).toBe(unsure);
	});

	it("marks every part of an unsure split by default", () => {
		const parts = split("Balenciaga");
		expect(parts.length).toBeGreaterThan(1);
		expect(parts.every((part) => part.splitUnsure)).toBe(true);
	});

	it("does not mark confident splits", () => {
		const parts = split("baby");
		expect(parts.map((part) => part.word)).toEqual(["ba", "by"]);
		expect(parts.some((part) => part.splitUnsure)).toBe(false);
	});

	it("splits without a mark, or leaves the word whole, when asked", () => {
		const unmarked = split("Balenciaga", "split");
		expect(unmarked.length).toBeGreaterThan(1);
		expect(unmarked.some((part) => part.splitUnsure)).toBe(false);

		expect(split("Balenciaga", "whole").map((part) => part.word)).toEqual([
			"Balenciaga",
		]);
		expect(split("baby", "whole").map((part) => part.word)).toEqual([
			"ba",
			"by",
		]);
	});

	it("marks only the unsure word when a word holds a whole line", () => {
		const parts = split("Balenciaga, the baby lion");
		const marked = parts
			.filter((part) => part.splitUnsure)
			.map((part) => part.word);
		expect(marked).toEqual(["Balen", "ci", "a", "ga,", "li", "on"]);
	});

	it("lists each unsure split once and clears all of its parts", () => {
		const line: LyricLine = {
			...newLyricLine(),
			words: [
				...split("Balenciaga"),
				{ ...newLyricWord(), word: " " },
				...split("baby"),
				{ ...newLyricWord(), word: " " },
				...split("lion"),
			],
		};
		const flagged = findUnsureSplitWords([line]);
		expect(flagged.map(({ wordId }) => wordId)).toEqual([
			line.words[0].id,
			line.words.find((word) => word.word === "li")?.id,
		]);

		clearUnsureSplits([line], new Set([line.words[2].id]));
		expect(findUnsureSplitWords([line])).toHaveLength(1);
		expect(line.words.slice(0, 4).some((word) => word.splitUnsure)).toBe(false);
	});
});
