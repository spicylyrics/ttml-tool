import { describe, expect, it } from "vitest";
import {
	type JoinedBackgroundRow,
	prepareTextImport,
	replaceTextRows,
	textToLines,
} from "./text-to-lines";

const words = (text: string, options = {}) =>
	textToLines(text, options).map((line) => line.words.map((word) => word.word));

describe("joined ad-libs", () => {
	it("reports source rows, and an edited row processes cleanly", () => {
		const text = "[Verse]\n'Rari (Red), crown (Stack)\nPlain line";
		const joined: JoinedBackgroundRow[] = [];
		expect(prepareTextImport(text, true, {}, joined)).toContain(
			"<Red,\\ \\stack",
		);
		expect(joined).toEqual([
			{
				row: 1,
				source: "'Rari (Red), crown (Stack)",
				suggestion: "'Rari, crown (Red, stack)",
			},
		]);
		const edited = replaceTextRows(
			text,
			new Map([[1, "'Rari, crown (Red, Stack)"]]),
		);
		expect(prepareTextImport(edited, true).split("\n")).toEqual([
			"[Verse]",
			"'Rari,\\ \\crown",
			"<Red,\\ \\Stack",
			"Plain\\ \\line",
		]);
	});
});

describe("shared text import", () => {
	it("trims edges, discards blank/header rows by default and splits hyphens", () => {
		expect(words("  well-known  song  \r\n\r\n[Chorus]\n end ")).toEqual([
			["well-", "known  song"],
			["end"],
		]);
	});

	it("keeps hyphenated words whole when hyphen splitting is off", () => {
		expect(words("Self-aware, twenty-one", { splitHyphens: false })).toEqual([
			["Self-aware, twenty-one"],
		]);
	});

	it("still splits hyphenated words through processing without hyphen splitting", () => {
		expect(
			words("twenty-one", { processLyrics: true, splitHyphens: false }),
		).toEqual([["twenty-", "one"]]);
	});

	it("preserves literal parentheses and CJK without processing", () => {
		expect(words("你世界 (hello)")).toEqual([["你世界 (hello)"]]);
	});

	it.each([
		"(backing)",
		"（backing）",
	])("processes %s as background vocals", (text) => {
		const [line] = textToLines(text, { processLyrics: true });
		expect(line.isBG).toBe(true);
		expect(line.words[0].word).toBe("Backing");
	});

	it("processes inline background vocals and CJK through the existing prep rules", () => {
		const lines = textToLines("  𠮷野Hello (君、僕)  ", {
			processLyrics: true,
		});
		expect(lines.map((line) => line.words.map((word) => word.word))).toEqual([
			["𠮷", "野", "Hello"],
			["君、", "僕"],
		]);
		expect(lines.map((line) => line.isBG)).toEqual([false, true]);
	});

	it("makes processed online import identical to importing its prepared preview", () => {
		const source = "[Chorus: Singer]\nhello-world (oh)\n\n[Verse 2]\n你好";
		const direct = textToLines(source, {
			processLyrics: true,
			sectionHeaders: "categorize",
		});
		const preview = textToLines(prepareTextImport(source, true), {
			wordSeparator: "\\",
			backgroundPrefix: "<",
			sectionHeaders: "categorize",
		});
		const behavior = (lines: typeof direct) =>
			lines.map(({ words, isBG, geniusHeader }) => ({
				words: words.map((word) => word.word),
				isBG,
				geniusHeader,
			}));
		expect(behavior(direct)).toEqual(behavior(preview));
		expect(direct[0].geniusHeader).toBeTruthy();
	});

	it("supports explicit blank/header preservation and whitespace collapsing", () => {
		expect(
			words("[Chorus]\n\n a   b ", {
				sectionHeaders: "preserve",
				blankLines: "preserve",
				collapseWhitespace: true,
			}),
		).toEqual([["[Chorus]"], [""], ["a b"]]);
	});

	it("keeps custom prefixes and literal word separators", () => {
		const [line] = textToLines("<><a|*b", {
			wordSeparator: "|*",
			backgroundPrefix: "<",
			duetPrefix: ">",
		});
		expect(line.isBG).toBe(true);
		expect(line.isDuet).toBe(true);
		expect(line.words.map((word) => word.word)).toEqual(["a", "b"]);
		expect(words("hello", { backgroundPrefix: "", duetPrefix: "" })).toEqual([
			["hello"],
		]);
	});

	it("doesn't count headers as translation rows", () => {
		const [line] = textToLines("[Verse]\noriginal\ntranslation\nroman", {
			mode: "lyric-trans-roman",
			sectionHeaders: "categorize",
			swapTransAndRoman: true,
		});
		expect(line.translatedLyric).toBe("roman");
		expect(line.romanLyric).toBe("translation");
	});

	it("fills missing same-line and interleaved subtitles with empty strings", () => {
		for (const lineSeparatorMode of [
			"same-line-separator",
			"interleaved-line",
		] as const) {
			const [line] = textToLines("original", {
				mode: "lyric-trans-roman",
				lineSeparatorMode,
			});
			expect(line.translatedLyric).toBe("");
			expect(line.romanLyric).toBe("");
		}
	});
});
