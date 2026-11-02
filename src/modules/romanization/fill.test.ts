import { describe, expect, it, vi } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import {
	capitalizeLine,
	lineRomanizationFromWords,
	mergeLineRomanization,
	romanizeLines,
} from "./fill";

vi.mock("./engines", () => ({
	romanizeSyllables: vi.fn(async (syllables: string[], language: string) =>
		syllables.map((syllable) =>
			/\p{Script=Han}|\p{Script=Hangul}|\p{Script=Hiragana}/u.test(syllable)
				? `${language}:${syllable.trim()}${/\s$/.test(syllable) ? " " : ""}`
				: "",
		),
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

	it("capitalizes a line that starts with a romanized word", () => {
		expect(capitalizeLine(["kimi ", "no"], ["君", "の"])).toEqual([
			"Kimi ",
			"no",
		]);
		expect(capitalizeLine(["", "hashi"], ["Oh ", "走"])).toEqual(["", "hashi"]);
	});

	it("romanizes each line in its own language and skips Latin lines", async () => {
		const results = await romanizeLines(
			[line("今日"), line("사랑 ", "해"), line("La la")],
			"ja",
			"fillEmpty",
		);
		expect(results.map((result) => result.romanLyric)).toEqual([
			"Ja:今日",
			"Ko:사랑 ko:해",
		]);
	});
});
