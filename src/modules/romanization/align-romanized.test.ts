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
			romanWords: ["A", "ri", "ga", "to", "u"],
			uncertain: false,
		});
		expect(align("issho ni", "いっ", "しょ", "に")).toEqual({
			romanWords: ["is", "sho ", "ni"],
			uncertain: false,
		});
		expect(align("kōhī", "コー", "ヒー")).toEqual({
			romanWords: ["kō", "hī"],
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
			romanWords: ["Boku ", "wa ", "kimi ", "wo"],
			uncertain: false,
		});
		expect(align("kimi o", "君", "を").romanWords).toEqual(["kimi ", "o"]);
	});

	it("gives a kanji word everything between its neighbours", () => {
		expect(align("Kimi no namae wo", "君", "の", "名前", "を")).toEqual({
			romanWords: ["Kimi ", "no ", "namae ", "wo"],
			uncertain: false,
		});
	});

	it("keeps capitals, macrons and apostrophes from the page", () => {
		expect(align("Kon'ya, Tōkyō de", "今夜", "東京", "で")).toEqual({
			romanWords: ["Kon'ya ", "Tōkyō ", "de"],
			uncertain: false,
		});
	});

	it("splits a kanji run by mora and flags it", () => {
		const result = align("namae wo", "名", "前", "を");
		expect(result.romanWords.join("")).toBe("namae wo");
		expect(result.uncertain).toBe(true);
	});

	it("keeps Latin words and skips spaces and punctuation", () => {
		expect(align("Oh yeah, hashiru", "Oh ", "yeah, ", "走", "る")).toEqual({
			romanWords: ["Oh ", "yeah ", "hashi", "ru"],
			uncertain: false,
		});
		expect(align("a i", "あ", " ", "い").romanWords).toEqual(["a ", "", "i"]);
	});

	it("flags a line whose romaji doesn't fit", () => {
		expect(align("totemo nagai", "あ").uncertain).toBe(true);
		expect(align("a extra", "あ").uncertain).toBe(true);
	});

	it("reads half-width katakana and long vowel marks", () => {
		expect(
			align("nande sonna koto", "なんで", "ｿﾝﾅ", "こと").romanWords,
		).toEqual(["nande ", "sonna ", "koto"]);
		expect(align("Hee, taishita", "へー、", "大した")).toEqual({
			romanWords: ["Hee ", "taishita"],
			uncertain: false,
		});
		expect(align("Se, no", "せ", "ー、", "の").romanWords).toEqual([
			"Se ",
			"",
			"no",
		]);
	});

	it("fits the whole line, not the first match", () => {
		expect(align("Kokoro wo shihai shite", "心", "を", "支配", "して")).toEqual(
			{ romanWords: ["Kokoro ", "wo ", "shihai ", "shite"], uncertain: false },
		);
	});

	it("gives a lone っ its doubled consonant", () => {
		expect(align("warui tte", "悪", "い", "っ", "て").romanWords).toEqual([
			"waru",
			"i ",
			"t",
			"te",
		]);
		expect(align("Kocchi ga", "こっ", "ち", "が").romanWords).toEqual([
			"Koc",
			"chi ",
			"ga",
		]);
	});

	it("splits kanji by sound without crossing a space", () => {
		expect(align("shihai", "支", "配")).toEqual({
			romanWords: ["shi", "hai"],
			uncertain: false,
		});
		expect(align("Senrigan", "千", "里", "眼")).toEqual({
			romanWords: ["Sen", "ri", "gan"],
			uncertain: false,
		});
		expect(align("ippo saki", "一", "歩", "先")).toEqual({
			romanWords: ["ip", "po ", "saki"],
			uncertain: false,
		});
	});

	it("turns look-alike Cyrillic letters into Latin", () => {
		const result = align("Ima, koе ga", "今、", "声", "が");
		expect(result.romanWords).toEqual(["Ima ", "koe ", "ga"]);
		expect(result.romanWords.join("")).toMatch(/^[\x20-\x7e]*$/);
	});
});

describe("romanized page lines", () => {
	it("groups lines under their headers and drops blank lines", () => {
		expect(
			parseRomanizedPage("intro\n[Verse 1]\nkimi no\n\n  boku wa  \n"),
		).toEqual([
			{ lines: [{ main: "intro", background: "" }] },
			{
				header: "Verse 1",
				lines: [
					{ main: "kimi no", background: "" },
					{ main: "boku wa", background: "" },
				],
			},
		]);
	});

	it("moves (parentheses) to the line's background", () => {
		expect(parseRomanizedPage("kimi no (ah) koe\n(ooh)\nboku")).toEqual([
			{
				lines: [
					{ main: "kimi no koe", background: "ah, ooh" },
					{ main: "boku", background: "" },
				],
			},
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

	it("aligns main lines and gives (parentheses) to background lines", () => {
		const lines = [line("君", "の"), { ...line("あ"), isBG: true }, line("僕")];
		const result = alignRomanizedPage(lines, "[Chorus]\nkimi no (a)\nboku");
		if (!result.ok) throw new Error("expected a match");
		expect(result.lines.map((aligned) => aligned.lineId)).toEqual([
			lines[0].id,
			lines[1].id,
			lines[2].id,
		]);
		expect(Object.values(result.lines[0].romanWords)).toEqual(["kimi ", "no"]);
		expect(Object.values(result.lines[1].romanWords)).toEqual(["a"]);
		expect(Object.values(result.lines[2].romanWords)).toEqual(["boku"]);
	});

	describe("with sections", () => {
		const sections = [
			{ id: "v", label: "[Verse 1]", category: "verse" as const },
			{ id: "c", label: "[Chorus]", category: "chorus" as const },
		];
		const lines = [
			{ ...line("君"), sectionId: "v" },
			{ ...line("僕"), sectionId: "v" },
			{ ...line("空"), sectionId: "c" },
		];

		it("matches each section on its own and skips one that differs", () => {
			const result = alignRomanizedPage(
				lines,
				"[Verse 1]\nkimi\nboku\nextra\n[Chorus]\nsora",
				sections,
			);
			if (!result.ok) throw new Error("expected a match");
			expect(result.lines.map((aligned) => aligned.lineId)).toEqual([
				lines[2].id,
			]);
			expect(result.skipped).toEqual([
				{ label: "Verse 1", lineNumber: 1, expected: 2, received: 3 },
			]);
		});

		it("says where the page stops lining up when sections don't pair", () => {
			expect(alignRomanizedPage(lines, "kimi\nsora", sections)).toEqual({
				ok: false,
				reason: "line-count",
				expected: 3,
				received: 2,
				firstDifference: undefined,
			});
			expect(
				alignRomanizedPage(
					lines,
					"[Verse 1]\nkimi\n[Bridge]\nboku\n[Chorus]\nsora\numi",
					sections,
				),
			).toMatchObject({
				ok: false,
				firstDifference: { label: "Verse 1", lineNumber: 1 },
			});
		});
	});

	it("numbers lines the way the editor does", () => {
		const lines = [
			line("君"),
			{ ...line("あ"), isBG: true },
			line(""),
			line("僕"),
		];
		const result = alignRomanizedPage(lines, "kimi\nboku");
		if (!result.ok) throw new Error("expected a match");
		expect(result.lines.map((aligned) => aligned.lineNumber)).toEqual([1, 3]);
	});
});
