import { describe, expect, it } from "vitest";
import { parseMarkup } from "$/components/LyricMarkupEditor/markup";
import { applyReviewedSections } from "$/modules/lyric-editor/utils/section-system";
import { prepareTextImport } from "$/modules/project/logic/text-to-lines";
import type { SegmentationConfig } from "$/modules/segmentation/types";
import { segmentWord } from "$/modules/segmentation/utils/segmentation";
import { newLyricWord, type TTMLLyric } from "$/types/ttml";
import {
	DEFAULT_LYRIC_PREP_OPTIONS,
	type LyricPrepOptions,
} from "$/utils/lyric-prep";
import {
	detectSections,
	DEFAULT_IMPORT_TEXT_FORMAT as FORMAT,
	hasSectionHeaders,
	type ImportTextFormat,
	importTextToLines,
	mergeReviewedSections,
	segmentImportText,
	toSectionOverrides,
} from "./import-text";

const words = (text: string, format = FORMAT, sections = false) =>
	importTextToLines(text, format, sections).map((line) =>
		line.words.map((word) => word.word),
	);

// Splits every run of letters into pairs, so tests don't depend on a dictionary.
const pairs = (word: string) => word.match(/.{1,2}/gu) ?? [word];

const GENIUS = `[Intro]
Ooh (yeah)

[Verse 1: Singer]
Hello world, it's me
I-I can't stop (Can't stop)

[Chorus]
Mm-hmm, la-la`;

describe("unified import parsing", () => {
	it("drops blank rows and makes sections from headers", () => {
		const lines = importTextToLines(
			prepareTextImport(GENIUS, true),
			FORMAT,
			true,
		);
		expect(lines.map((line) => line.geniusHeader)).toEqual([
			"[Intro]",
			"[Intro]",
			"[Verse 1: Singer]",
			"[Verse 1: Singer]",
			"[Verse 1: Singer]",
			"[Chorus]",
		]);
		expect(lines.map((line) => line.isBG)).toEqual([
			false,
			true,
			false,
			false,
			true,
			false,
		]);
		expect(lines.every((line) => line.words.length > 0)).toBe(true);
	});

	it("drops headers when sections are off", () => {
		const lines = importTextToLines(GENIUS, FORMAT, false);
		// Unprocessed, so parentheses stay on their line.
		expect(lines).toHaveLength(4);
		expect(lines.some((line) => line.geniusHeader)).toBe(false);
		expect(
			lines.some((line) => line.words.some((word) => word.word.includes("["))),
		).toBe(false);
	});

	it("keeps hyphenated words whole unless Process lyrics marked the split", () => {
		expect(words("Mm-hmm, la-la")).toEqual([["Mm-hmm, la-la"]]);
		expect(words("Mm-\\hmm")).toEqual([["Mm-", "hmm"]]);
	});

	it("reads Genius text after Process lyrics the way the old online import did", () => {
		expect(words(prepareTextImport("Hello world (oh)", true))).toEqual([
			["Hello", " ", "world"],
			["Oh"],
		]);
	});

	it("reads prefixes, translations and a custom separator", () => {
		const format: ImportTextFormat = {
			...FORMAT,
			mode: "lyric-trans",
			wordSeparator: "/",
		};
		const [bg, duet] = importTextToLines(
			"<Hel/lo\nHallo\n>Bye\nTschüss",
			format,
			false,
		);
		expect(bg).toMatchObject({ isBG: true, translatedLyric: "Hallo" });
		expect(bg.words.map((word) => word.word)).toEqual(["Hel", "lo"]);
		expect(duet).toMatchObject({ isDuet: true, translatedLyric: "Tschüss" });
	});
});

describe("markup editor agrees with the import format", () => {
	const kinds = (text: string, format = FORMAT, sections = true) =>
		parseMarkup(text, { ...format, makeSections: sections }).map((row) =>
			row.category ? `${row.kind}:${row.category}` : row.kind,
		);

	it("gives one entry per row and agrees with the parser", () => {
		const text = "[Chorus]\nHello\n<Ooh\n>Hey\n\n[Mystery]";
		expect(kinds(text)).toEqual([
			"section:chorus",
			"lyric",
			"background",
			"duet",
			"blank",
			"section:other",
		]);
		expect(kinds(text, FORMAT, false)[0]).toBe("removedHeader");
		const lines = importTextToLines(text, FORMAT, true);
		expect(
			lines.map((line) => (line.isBG ? "bg" : line.isDuet ? "duet" : "lyric")),
		).toEqual(["lyric", "bg", "duet"]);
	});

	it("marks translation and romanization rows", () => {
		expect(
			kinds("Hello\nHallo\nHaro\nBye\nTschüss\nBai", {
				...FORMAT,
				mode: "lyric-trans-roman",
			}),
		).toEqual([
			"lyric",
			"translation",
			"romanization",
			"lyric",
			"translation",
			"romanization",
		]);
		expect(
			kinds("Hello\nHaro", {
				...FORMAT,
				mode: "lyric-trans-roman",
				swapTransAndRoman: true,
			}),
		).toEqual(["lyric", "romanization"]);
		expect(
			kinds("Hello|Hallo", {
				...FORMAT,
				mode: "lyric-trans",
				lineSeparatorMode: "same-line-separator",
			}),
		).toEqual(["lyric"]);
	});
});

describe("section review", () => {
	it("detects sections with line counts and their first line", () => {
		const sections = detectSections(GENIUS);
		expect(
			sections.map(({ label, category, lineCount, firstLine }) => ({
				label,
				category,
				lineCount,
				firstLine,
			})),
		).toEqual([
			{
				label: "[Intro]",
				category: "intro",
				lineCount: 1,
				firstLine: "Ooh (yeah)",
			},
			{
				label: "[Verse 1: Singer]",
				category: "verse",
				lineCount: 2,
				firstLine: "Hello world, it's me",
			},
			{
				label: "[Chorus]",
				category: "chorus",
				lineCount: 1,
				firstLine: "Mm-hmm, la-la",
			},
		]);
		expect(hasSectionHeaders(GENIUS)).toBe(true);
		expect(hasSectionHeaders("No [headers] here")).toBe(false);
	});

	it("keeps a changed category when the text around it is edited", () => {
		const [intro, verse] = detectSections(GENIUS);
		const edited = mergeReviewedSections(
			[intro, { ...verse, category: "hook", confidence: 1 }],
			detectSections(`${GENIUS}\nOne more line`),
		);
		expect(edited.map((section) => section.category)).toEqual([
			"intro",
			"hook",
			"chorus",
		]);
	});
});

describe("applying reviewed sections", () => {
	it("stores the reviewed category without review-only fields", () => {
		const [intro, verse, chorus] = detectSections(GENIUS);
		const lyrics: TTMLLyric = {
			lyricLines: importTextToLines(GENIUS, FORMAT, true),
			metadata: [],
			sections: [],
		};
		applyReviewedSections(
			lyrics,
			toSectionOverrides([intro, { ...verse, category: "hook" }, chorus]),
		);
		const sections = lyrics.sections ?? [];
		expect(sections.map((section) => section.category)).toEqual([
			"intro",
			"hook",
			"chorus",
		]);
		expect(sections.some((section) => "firstLine" in section)).toBe(false);
	});
});

describe("syllable splitting in the import text", () => {
	it("marks syllables and keeps headers, blanks and spaces", () => {
		expect(
			segmentImportText("[Chorus]\nHello world\n\n<Mm yeah", FORMAT, pairs),
		).toBe("[Chorus]\nHe\\ll\\o\\ \\wo\\rl\\d\n\n<Mm\\ \\ye\\ah");
	});

	it("re-splits processed text without doubling separators", () => {
		const processed = prepareTextImport("Hello world", true);
		expect(segmentImportText(processed, FORMAT, pairs)).toBe(
			"He\\ll\\o\\ \\wo\\rl\\d",
		);
	});

	it("leaves translation rows and the same-line translation alone", () => {
		expect(
			segmentImportText(
				"Hello\nHallo",
				{ ...FORMAT, mode: "lyric-trans" },
				pairs,
			),
		).toBe("He\\ll\\o\nHallo");
		expect(
			segmentImportText(
				"Hello|Hallo",
				{
					...FORMAT,
					mode: "lyric-trans",
					lineSeparatorMode: "same-line-separator",
				},
				pairs,
			),
		).toBe("He\\ll\\o|Hallo");
	});

	it("does nothing without a word separator", () => {
		expect(
			segmentImportText("Hello", { ...FORMAT, wordSeparator: "" }, pairs),
		).toBe("Hello");
	});

	it("ignores a split that would change the text", () => {
		expect(segmentImportText("Hello", FORMAT, () => ["Hi"])).toBe("Hello");
	});

	it("applies learned splits through Auto segment", () => {
		const config: SegmentationConfig = {
			engine: "none",
			splitCJK: true,
			splitEnglish: true,
			punctuationWeight: 0.2,
			punctuationMode: "merge",
			removeEmptySegments: true,
			ignoreList: new Set(),
			customRules: new Map(),
			learnedRules: new Map([["beautiful", [4, 7]]]),
		};
		const split = (word: string) =>
			segmentWord({ ...newLyricWord(), word }, config).map((part) => part.word);
		const text = segmentImportText("So beautiful, yeah", FORMAT, split);
		expect(text).toBe("So\\ \\beau\\tif\\ul,\\ \\yeah");
		expect(words(text)).toEqual([
			["So", " ", "beau", "tif", "ul,", " ", "yeah"],
		]);
	});
});

describe("text tools run twice", () => {
	const segmentation: SegmentationConfig = {
		engine: "basic",
		splitCJK: true,
		splitEnglish: true,
		punctuationWeight: 0.2,
		punctuationMode: "merge",
		removeEmptySegments: true,
		ignoreList: new Set(),
		customRules: new Map(),
		learnedRules: new Map([["beautiful", [4, 7]]]),
	};
	const autoSegment = (word: string) =>
		segmentWord({ ...newLyricWord(), word }, segmentation).map(
			(part) => part.word,
		);
	const translated: ImportTextFormat = { ...FORMAT, mode: "lyric-trans" };
	const inputs: [string, string, ImportTextFormat][] = [
		[
			"Genius paste",
			`[Intro: Singer]\nOoh (yeah)\n\n[Verse 1]\nHello beautiful world, it's me\nI-I can't stop (Can't stop)\nMm-hmm, la-la -- wait - no\n\n[Chorus]\n你好世界 (君、僕)`,
			FORMAT,
		],
		[
			"existing split marks",
			"Hello \beau\ti\ful world\n<Twen\ty-one okay",
			FORMAT,
		],
		[
			"translations",
			"Hello beautiful world\nHallo schöne Welt\nGood-bye (bye)\nAuf Wiedersehen",
			translated,
		],
	];
	const tools: [string, (text: string, format: ImportTextFormat) => string][] =
		[
			["Process lyrics", (text) => prepareTextImport(text, true)],
			...(
				[
					{ emDashes: false },
					{ splitWords: false },
					{ backgroundVocals: false, splitHyphens: false },
					{ punctuationSpacing: false, collapseSpaces: false },
					{ splitCjk: false, capitalizeBackground: false },
					Object.fromEntries(
						Object.keys(DEFAULT_LYRIC_PREP_OPTIONS).map((key) => [key, false]),
					),
				] as Partial<LyricPrepOptions>[]
			).map(
				(steps) =>
					[
						`Process lyrics with ${JSON.stringify(steps)}`,
						(text: string) => prepareTextImport(text, true, steps),
					] as [string, (text: string, format: ImportTextFormat) => string],
			),
			[
				"Split syllables",
				(text, format) => segmentImportText(text, format, autoSegment),
			],
			[
				"Split syllables (pairs)",
				(text, format) => segmentImportText(text, format, pairs),
			],
		];

	for (const [toolName, tool] of tools) {
		it.each(inputs)(`${toolName} on %s`, (_name, input, format) => {
			const once = tool(input, format);
			expect(tool(once, format)).toBe(once);
		});
	}

	it("keeps split marks when processing after splitting", () => {
		const split = segmentImportText("So beautiful", FORMAT, autoSegment);
		expect(prepareTextImport(split, true)).toBe(split);
	});
});
