import { describe, expect, it } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import {
	alignLineWords,
	alignRomanizedPage,
	normalizeRomaji,
	parseRomanizedPage,
	splitRomajiMorae,
} from "./align-romanized";

const words = (...parts: string[]) =>
	parts.map((word) => ({ ...newLyricWord(), word }));

const line = (...parts: string[]): LyricLine => ({
	...newLyricLine(),
	words: words(...parts),
});

const align = (romaji: string, ...parts: string[]) =>
	alignLineWords(words(...parts), romaji);

describe("romanized page alignment", () => {
	it("normalizes romaji and splits morae", () => {
		expect(normalizeRomaji("Kyō wa, ii tenki!")).toBe("kyouwaiitenki");
		expect(splitRomajiMorae("kitto")).toEqual(["ki", "t", "to"]);
		expect(splitRomajiMorae("sanpo")).toEqual(["sa", "n", "po"]);
	});

	it("matches kana words by their reading", () => {
		expect(align("Arigatou", "あ", "り", "が", "と", "う")).toEqual({
			romanWords: ["a", "ri", "ga", "to", "u"],
			uncertain: false,
		});
		expect(align("issho ni", "いっ", "しょ", "に")).toEqual({
			romanWords: ["is", "sho", "ni"],
			uncertain: false,
		});
		expect(align("kōhī", "コー", "ヒー")).toEqual({
			romanWords: ["kou", "hii"],
			uncertain: false,
		});
		expect(align("koohii", "コー", "ヒー").romanWords).toEqual(["koo", "hii"]);
		expect(align("faito", "ファ", "イ", "ト").romanWords).toEqual([
			"fa",
			"i",
			"to",
		]);
	});

	it("reads particles the way pages spell them", () => {
		expect(align("Boku wa kimi wo", "僕", "は", "君", "を")).toEqual({
			romanWords: ["boku", "wa", "kimi", "wo"],
			uncertain: false,
		});
		expect(align("kimi o", "君", "を").romanWords).toEqual(["kimi", "o"]);
	});

	it("gives a kanji word everything between its neighbours", () => {
		expect(align("Kimi no namae wo", "君", "の", "名前", "を")).toEqual({
			romanWords: ["kimi", "no", "namae", "wo"],
			uncertain: false,
		});
	});

	it("splits a kanji run by mora and flags it", () => {
		const result = align("namae wo", "名", "前", "を");
		expect(result.romanWords.join("")).toBe("namaewo");
		expect(result.uncertain).toBe(true);
	});

	it("keeps Latin words and skips spaces and punctuation", () => {
		expect(align("Oh yeah, hashiru", "Oh ", "yeah, ", "走", "る")).toEqual({
			romanWords: ["oh", "yeah", "hashi", "ru"],
			uncertain: false,
		});
		expect(align("a i", "あ", " ", "い").romanWords).toEqual(["a", "", "i"]);
	});

	it("flags a line whose romaji doesn't fit", () => {
		expect(align("totemo nagai", "あ").uncertain).toBe(true);
		expect(align("a extra", "あ").uncertain).toBe(true);
	});
});

describe("romanized page lines", () => {
	it("drops blank lines and section headers", () => {
		expect(parseRomanizedPage("[Verse 1]\nkimi no\n\n  boku wa  \n")).toEqual([
			"kimi no",
			"boku wa",
		]);
	});

	it("refuses a page with a different line count", () => {
		expect(alignRomanizedPage([line("君"), line("僕")], "kimi")).toEqual({
			ok: false,
			reason: "line-count",
			expected: 2,
			received: 1,
		});
	});

	it("aligns main lines and skips background lines", () => {
		const lines = [line("君", "の"), { ...line("あ"), isBG: true }, line("僕")];
		const result = alignRomanizedPage(lines, "[Chorus]\nkimi no\nboku");
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.lines.map((aligned) => aligned.lineId)).toEqual([
			lines[0].id,
			lines[2].id,
		]);
		expect(Object.values(result.lines[0].romanWords)).toEqual(["kimi", "no"]);
		expect(Object.values(result.lines[1].romanWords)).toEqual(["boku"]);
	});
});
