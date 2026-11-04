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

	it("takes a pasted page's line as written, unless old words stay", () => {
		const target = line("抜かしてん", "だ", "か？");
		const romanWords = Object.fromEntries(
			target.words.map((word, index) => [
				word.id,
				["nukashiten", "da ", "ka?"][index],
			]),
		);
		expect(
			mergeLineRomanization(target, romanWords, "replace", "nukashite nda ka?")
				?.romanLyric,
		).toBe("nukashite nda ka?");
		const kept = line(["抜かしてん", "Nukashiten"], "だ", "か？");
		expect(
			mergeLineRomanization(
				kept,
				{ [kept.words[1].id]: "da ", [kept.words[2].id]: "ka?" },
				"fillEmpty",
				"nukashite nda ka?",
			)?.romanLyric,
		).toBe("Nukashitenda ka?");
	});

	it("clears earlier romaji on English words when replacing from a page", () => {
		const mixed = line(["gimme ", "Gimme "], ["ちょう", "chou"], "だい");
		const [gimme, chou, dai] = mixed.words;
		const romanWords = {
			[gimme.id]: "",
			[chou.id]: "chou",
			[dai.id]: "dai",
		};
		expect(
			mergeLineRomanization(mixed, romanWords, "replace", "Gimme choudai"),
		).toMatchObject({
			romanWords: { [gimme.id]: "", [chou.id]: "chou", [dai.id]: "dai" },
			romanLyric: "Gimme choudai",
		});
		expect(
			mergeLineRomanization(mixed, romanWords, "fillEmpty")?.romanWords[
				gimme.id
			],
		).toBe("Gimme ");

		const english = {
			...line(["Look ", "Look "], ["around!", "around!"]),
			romanLyric: "Look around!",
		};
		const blank = Object.fromEntries(english.words.map((w) => [w.id, ""]));
		expect(mergeLineRomanization(english, blank, "replace", "")).toMatchObject({
			romanWords: Object.fromEntries(english.words.map((w) => [w.id, ""])),
			romanLyric: "",
		});
		const stale = { ...line("Look ", "around!"), romanLyric: "Look around!" };
		expect(
			mergeLineRomanization(
				stale,
				Object.fromEntries(stale.words.map((w) => [w.id, ""])),
				"replace",
				"",
			)?.romanLyric,
		).toBe("");
	});

	it("fills over leftover romanization that is still in kana", () => {
		const target = line(["ソンナ", "ソンナ"]);
		expect(
			mergeLineRomanization(
				target,
				{ [target.words[0].id]: "sonna" },
				"fillEmpty",
			)?.romanLyric,
		).toBe("sonna");
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

	it("keeps Latin words of a mixed line in its romanization", async () => {
		const [result] = await romanizeLines(
			[line("Oh ", "yeah ", "사랑")],
			"ko",
			"fillEmpty",
		);
		expect(Object.values(result.romanWords)).toEqual([
			"Oh ",
			"yeah ",
			"ko:사랑",
		]);
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
