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

	it("keeps capitals, macrons, apostrophes and punctuation from the page", () => {
		expect(align("Kon'ya, Tōkyō de", "今夜", "東京", "で")).toEqual({
			romanWords: ["Kon'ya, ", "Tōkyō ", "de"],
			uncertain: false,
		});
	});

	it("splits a kanji run by mora and flags it", () => {
		const result = align("namae wo", "名", "前", "を");
		expect(result.romanWords.join("")).toBe("namae wo");
		expect(result.uncertain).toBe(true);
	});

	it("keeps Latin words and skips spaces", () => {
		expect(align("Oh yeah, hashiru", "Oh ", "yeah, ", "走", "る")).toEqual({
			romanWords: ["Oh ", "yeah, ", "hashi", "ru"],
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
			romanWords: ["Hee, ", "taishita"],
			uncertain: false,
		});
		expect(align("Se, no", "せ", "ー、", "の").romanWords).toEqual([
			"Se, ",
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
		expect(result.romanWords).toEqual(["Ima, ", "koe ", "ga"]);
		expect(result.romanWords.join("")).toMatch(/^[\x20-\x7e]*$/);
	});

	it("keeps the page's quotes, commas and question marks on the words", () => {
		expect(
			align(
				'"Oi, nande sonna koto yatte n no?"',
				"「おい、",
				"なんで",
				"ｿﾝﾅ",
				"こと",
				"やっ",
				"てん",
				"の？」",
			).romanWords,
		).toEqual(['"Oi, ', "nande ", "sonna ", "koto ", "yat", "ten ", 'no?"']);
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

	const romaji = (result: ReturnType<typeof alignRomanizedPage>) => {
		if (!result.ok) throw new Error("expected a match");
		return result.lines.map((aligned) => Object.values(aligned.romanWords));
	};

	it("follows the words when the page breaks lines differently", () => {
		const lines = [line("どう", "した", "って"), line("消せない", "夢", "も")];
		expect(
			romaji(alignRomanizedPage(lines, "Dou shitatte kesenai yume mo")),
		).toEqual([
			["Dou ", "shita", "tte"],
			["kesenai ", "yume ", "mo"],
		]);
		expect(
			romaji(
				alignRomanizedPage(
					[line("君", "の", "名前", "を", "呼んで", "いた")],
					"Kimi no namae wo\nyonde ita",
				),
			),
		).toEqual([["Kimi ", "no ", "namae ", "wo ", "yonde ", "ita"]]);
	});

	it("gives each line the page's own text for it", () => {
		const result = alignRomanizedPage(
			[line("「無駄", "な", "こと"), line("抜かしてん", "だ", "か？")],
			'"Mudana koto\nnukashite nda ka?"',
		);
		if (!result.ok) throw new Error("expected a match");
		expect(result.lines.map((aligned) => aligned.romanLine)).toEqual([
			'"Mudana koto',
			'nukashite nda ka?"',
		]);
	});

	it("skips a line only the page has", () => {
		const lines = [line("君", "の"), line("僕", "は")];
		expect(
			romaji(alignRomanizedPage(lines, "kimi no\nla la la la\nboku wa")),
		).toEqual([
			["kimi ", "no"],
			["boku ", "wa"],
		]);
	});

	it("pins kanji words by their kana", () => {
		expect(
			align("omoi araizarai hakidashita", "想い", "洗いざらい", "吐き出した")
				.romanWords,
		).toEqual(["omoi ", "araizarai ", "hakidashita"]);
	});

	it("reads Korean words", () => {
		expect(align("bam pyeonji", "밤", "편지")).toEqual({
			romanWords: ["bam ", "pyeonji"],
			uncertain: false,
		});
		// Spelled by sound, but alone between spaces: not flagged.
		expect(align("ireoke malhanikka", "이렇게", "말하니까")).toEqual({
			romanWords: ["ireoke ", "malhanikka"],
			uncertain: false,
		});
	});

	it("refuses a page for another song", () => {
		expect(
			alignRomanizedPage(
				[line("ありがとう", "ございます"), line("さようなら", "また", "ね")],
				"Kimi no namae wo\nyonde ita",
			),
		).toEqual({ ok: false, reason: "mismatch" });
		// A kanji-heavy page split by sound is mostly guesses, but still fills.
		expect(
			alignRomanizedPage(
				[line("千", "里", "眼", "を", "持", "つ")],
				"Senrigan wo motsu",
			).ok,
		).toBe(true);
	});

	it("aligns main lines and gives (parentheses) to background lines", () => {
		const lines = [line("君", "の"), { ...line("あ"), isBG: true }, line("僕")];
		const result = alignRomanizedPage(lines, "[Chorus]\nkimi no (a)\nboku");
		if (!result.ok) throw new Error("expected a match");
		const byLine = new Map(
			result.lines.map((aligned) => [
				aligned.lineId,
				Object.values(aligned.romanWords),
			]),
		);
		expect(lines.map((target) => byLine.get(target.id))).toEqual([
			["kimi ", "no"],
			["a"],
			["boku"],
		]);
	});

	it("keeps no romaji for English words and English-only lines", () => {
		const lines = [
			line("Oh ", "my ", "God, ", "大嫌い"),
			{ ...line("Look ", "around!"), isBG: true },
			line("gimme ", "ちょう", "だい"),
		];
		const result = alignRomanizedPage(
			lines,
			"Oh my God, daikirai (Look around!)\nGimme choudai",
		);
		if (!result.ok) throw new Error("expected a match");
		const byLine = new Map(
			result.lines.map((aligned) => [aligned.lineId, aligned]),
		);
		const [mixed, background, gimme] = lines.map((target) =>
			byLine.get(target.id),
		);
		expect(Object.values(mixed?.romanWords ?? {})).toEqual([
			"",
			"",
			"",
			"daikirai",
		]);
		expect(mixed?.romanLine).toBe("Oh my God, daikirai");
		expect(Object.values(background?.romanWords ?? {})).toEqual(["", ""]);
		expect(background?.romanLine).toBe("");
		expect(Object.values(gimme?.romanWords ?? {})).toEqual(["", "chou", "dai"]);
	});

	it("pulls a section toward its header on the page", () => {
		// Without headers, 空 could take "sora umi" and 海 nothing.
		const lines = [
			{ ...line("空", "の"), sectionId: "v" },
			{ ...line("海"), sectionId: "c" },
		];
		expect(
			romaji(alignRomanizedPage(lines, "[Verse]\nsora no\n[Chorus]\numi")),
		).toEqual([["sora ", "no"], ["umi"]]);
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
