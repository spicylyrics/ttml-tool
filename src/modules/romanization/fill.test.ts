import { describe, expect, it, vi } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import {
	lineRomanizationFromWords,
	mergeLineRomanization,
	romanizeLines,
	wordEnds,
} from "./fill";

const READINGS: Record<string, string> = {
	君: "kimi",
	の: "no",
	名: "na",
	前: "mae",
	を: "wo",
};

vi.mock("$/utils/phonetic", () => ({
	getPhoneticSyllables: vi.fn(async (capsules: string[], language: string) =>
		capsules.map((capsule) =>
			READINGS[capsule]
				? READINGS[capsule]
				: /\p{Script=Han}|\p{Script=Hangul}|\p{Script=Hiragana}/u.test(capsule)
					? `${language}:${capsule.trim()}`
					: "",
		),
	),
	getPhonetic: vi.fn(async (text: string) =>
		text === "君の名前を" ? "Kimi no Namae wo" : "",
	),
}));

const line = (...parts: Array<string | [string, string]>): LyricLine => ({
	...newLyricLine(),
	words: parts.map((part) => {
		const [word, romanWord] = typeof part === "string" ? [part, ""] : part;
		return { ...newLyricWord(), word, romanWord };
	}),
});

describe("filling romanization", () => {
	it("builds the line romanization from its words", () => {
		expect(
			lineRomanizationFromWords([
				{ word: "君", romanWord: "kimi" },
				{ word: "の", romanWord: "no " },
				{ word: "love ", romanWord: "" },
				{ word: "you", romanWord: "" },
			]),
		).toBe("kimino love you");
	});

	it("keeps existing words unless replacing", () => {
		const target = line(["君", "Kimi"], "の");
		const [first, second] = target.words;
		const romanWords = { [first.id]: "kimi", [second.id]: "no" };
		expect(
			mergeLineRomanization(target, romanWords, "fillEmpty")?.romanWords,
		).toEqual({ [first.id]: "Kimi", [second.id]: "no" });
		expect(
			mergeLineRomanization(target, romanWords, "replace")?.romanLyric,
		).toBe("kimino");
	});

	it("reports nothing when no word changes", () => {
		const target = line(["君", "kimi"]);
		expect(
			mergeLineRomanization(
				target,
				{ [target.words[0].id]: "kimi" },
				"fillEmpty",
			),
		).toBeUndefined();
	});

	it("finds word ends from the spaced line reading", () => {
		expect(
			wordEnds(
				["kimi", "no", "na", "mae", "wo"],
				["君", "の", "名", "前", "を"],
				"Kimi no Namae wo",
			),
		).toEqual([true, true, false, true, false]);
		expect(wordEnds(["ko", "u", "hii"], ["コ", "ー", "ヒー"], "kōhī")).toEqual([
			false,
			false,
			false,
		]);
		// English words count with their own letters.
		expect(
			wordEnds(["", "hashi", "ru"], ["Oh ", "走", "る"], "Oh hashiru"),
		).toEqual([false, false, false]);
		// Readings that don't add up leave the gaps out.
		expect(wordEnds(["kon", "nichi"], ["今", "日"], "kyou")).toEqual([
			false,
			false,
		]);
	});

	it("puts Genius-style gaps between Japanese words", async () => {
		const [result] = await romanizeLines(
			[line("君", "の", "名", "前", "を")],
			"ja",
			"fillEmpty",
		);
		expect(Object.values(result.romanWords)).toEqual([
			"kimi ",
			"no ",
			"na",
			"mae ",
			"wo",
		]);
		expect(result.romanLyric).toBe("kimi no namae wo");
	});

	it("romanizes each line in its own language and skips Latin lines", async () => {
		const results = await romanizeLines(
			[line("今日"), line("사랑 ", "해"), line("La la")],
			"ja",
			"fillEmpty",
		);
		expect(results.map((result) => result.romanLyric)).toEqual([
			"ja:今日",
			"ko:사랑 ko:해",
		]);
	});
});
