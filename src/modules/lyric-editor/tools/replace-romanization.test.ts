import { describe, expect, it } from "vitest";
import { replaceRomanization } from "./replace-romanization";

const lines = () => [
	{
		words: [
			{ word: "Hello", romanWord: "old-one" },
			{ word: "hello", romanWord: "old-two" },
		],
	},
	{ words: [{ word: "Hello", romanWord: "old-three" }] },
];

describe("replaceRomanization", () => {
	it("updates only the targeted word by default", () => {
		const lyricLines = lines();
		replaceRomanization(lyricLines, {
			lineIndex: 0,
			wordIndex: 0,
			targetWord: "Hello",
			replacement: "new",
			applyToAll: false,
			caseSensitive: true,
		});

		expect(
			lyricLines.map((line) => line.words.map((word) => word.romanWord)),
		).toEqual([["new", "old-two"], ["old-three"]]);
	});

	it("updates every exact source-word match", () => {
		const lyricLines = lines();
		replaceRomanization(lyricLines, {
			lineIndex: 0,
			wordIndex: 0,
			targetWord: "Hello",
			replacement: "new",
			applyToAll: true,
			caseSensitive: true,
		});

		expect(
			lyricLines.map((line) => line.words.map((word) => word.romanWord)),
		).toEqual([["new", "old-two"], ["new"]]);
	});

	it("supports case-insensitive source-word matching", () => {
		const lyricLines = lines();
		replaceRomanization(lyricLines, {
			lineIndex: 0,
			wordIndex: 0,
			targetWord: "Hello",
			replacement: "new",
			applyToAll: true,
			caseSensitive: false,
		});

		expect(
			lyricLines.flatMap((line) => line.words.map((word) => word.romanWord)),
		).toEqual(["new", "new", "new"]);
	});

	it("ignores edge punctuation the way Combine does, unless case matters", () => {
		const lyricLines = [
			{
				words: [
					{ word: "You", romanWord: "a" },
					{ word: "you,", romanWord: "b" },
					{ word: "(you)", romanWord: "c" },
					{ word: "your", romanWord: "d" },
				],
			},
		];
		const options = {
			lineIndex: 0,
			wordIndex: 0,
			targetWord: "You",
			replacement: "new",
			applyToAll: true,
		};
		replaceRomanization(lyricLines, { ...options, caseSensitive: false });
		expect(lyricLines[0].words.map((word) => word.romanWord)).toEqual([
			"new",
			"new",
			"new",
			"d",
		]);

		lyricLines[0].words[1].romanWord = "b";
		replaceRomanization(lyricLines, {
			...options,
			replacement: "exact",
			caseSensitive: true,
		});
		expect(lyricLines[0].words.map((word) => word.romanWord)).toEqual([
			"exact",
			"b",
			"new",
			"d",
		]);
	});
});
