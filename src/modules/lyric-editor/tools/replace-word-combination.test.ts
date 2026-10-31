import { describe, expect, it } from "vitest";
import type { LyricLine } from "$/types/ttml";
import {
	getWordCombinationSelection,
	replaceWordCombination,
} from "./replace-word-combination";

// Only ids and text matter to these functions.
const lines = () =>
	[
		{
			id: "l1",
			words: [
				{ id: "a", word: "I " },
				{ id: "b", word: "dont " },
				{ id: "c", word: "know" },
			],
		},
		{
			id: "l2",
			words: [
				{ id: "d", word: "Dont " },
				{ id: "e", word: "know" },
				{ id: "f", word: "dont " },
				{ id: "g", word: "know" },
			],
		},
	] as unknown as LyricLine[];

const texts = (lyricLines: LyricLine[]) =>
	lyricLines.map((line) => line.words.map((word) => word.word));

describe("getWordCombinationSelection", () => {
	it("returns adjacent words on one line in order", () => {
		expect(getWordCombinationSelection(lines(), new Set(["c", "b"]))).toEqual({
			lineId: "l1",
			words: [
				{ id: "b", word: "dont " },
				{ id: "c", word: "know" },
			],
		});
	});

	it("rejects a single word, gaps and words on different lines", () => {
		expect(getWordCombinationSelection(lines(), new Set(["a"]))).toBeNull();
		expect(
			getWordCombinationSelection(lines(), new Set(["a", "c"])),
		).toBeNull();
		expect(
			getWordCombinationSelection(lines(), new Set(["c", "d"])),
		).toBeNull();
	});
});

describe("replaceWordCombination", () => {
	const selection = {
		lineId: "l1",
		words: [
			{ id: "b", word: "dont " },
			{ id: "c", word: "know" },
		],
	};

	it("replaces only the selected words by default", () => {
		const lyricLines = lines();
		expect(
			replaceWordCombination(
				lyricLines,
				selection,
				["don't ", "know"],
				false,
				true,
			),
		).toBe(1);
		expect(texts(lyricLines)).toEqual([
			["I ", "don't ", "know"],
			["Dont ", "know", "dont ", "know"],
		]);
	});

	it("replaces every exact match, matching case", () => {
		const lyricLines = lines();
		expect(
			replaceWordCombination(
				lyricLines,
				selection,
				["don't ", "know"],
				true,
				true,
			),
		).toBe(2);
		expect(texts(lyricLines)).toEqual([
			["I ", "don't ", "know"],
			["Dont ", "know", "don't ", "know"],
		]);
	});

	it("ignores case when asked", () => {
		const lyricLines = lines();
		expect(
			replaceWordCombination(
				lyricLines,
				selection,
				["don't ", "know"],
				true,
				false,
			),
		).toBe(3);
	});

	it("does nothing when the lyrics changed under the dialog", () => {
		const lyricLines = lines();
		lyricLines[0].words[1].word = "do ";
		expect(
			replaceWordCombination(
				lyricLines,
				selection,
				["don't ", "know"],
				false,
				true,
			),
		).toBe(0);
		expect(texts(lyricLines)[0]).toEqual(["I ", "do ", "know"]);
	});
});
