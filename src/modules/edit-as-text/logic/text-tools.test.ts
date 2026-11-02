// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import { DEFAULT_LYRIC_PREP_OPTIONS } from "$/utils/lyric-prep";
import fixture from "./fixtures/synced.ttml?raw";
import { editTextFormat, serializeLyrics } from "./serialize";
import { applyEditedText } from "./text-diff";
import { processTextRows, splitTextRows } from "./text-tools";

const STEPS = DEFAULT_LYRIC_PREP_OPTIONS;

function lyricsOf(
	lines: { words: string[]; translatedLyric?: string; isBG?: boolean }[],
): TTMLLyric {
	return {
		lyricLines: lines.map(({ words, ...rest }) => ({
			...newLyricLine(),
			...rest,
			words: words.map((word) => ({ ...newLyricWord(), word })),
		})),
		metadata: [],
	} as unknown as TTMLLyric;
}

describe("processTextRows", () => {
	it("leaves already clean lyrics with nothing to apply", () => {
		const lyrics = parseLyric(fixture);
		const format = editTextFormat(lyrics);
		const text = serializeLyrics(lyrics, format);
		// The fixture's "I-I" is one word on purpose; hyphen splitting would split it.
		const processed = processTextRows(
			text,
			format,
			{ ...STEPS, splitHyphens: false },
			null,
		);
		expect(applyEditedText(lyrics, processed, format).summary.hasChanges).toBe(
			false,
		);
	});

	it("keeps words that already have syllable marks as they are", () => {
		const lyrics = lyricsOf([{ words: ["a"] }]);
		const format = editTextFormat(lyrics);
		const sep = format.wordSeparator;
		const text = `La${sep}-la${sep} ${sep}to${sep}night`;
		expect(processTextRows(text, format, STEPS, null)).toBe(text);
	});

	it("tidies a typed line and moves its parentheses to a background row", () => {
		const lyrics = lyricsOf([{ words: ["Old line"] }]);
		const format = editTextFormat(lyrics);
		const processed = processTextRows(
			"hold  me close (hold me)",
			format,
			STEPS,
			null,
		);
		const rows = processed.split("\n");
		expect(rows).toHaveLength(2);
		expect(rows[0].startsWith(format.bgLyricPrefix)).toBe(false);
		expect(rows[1].startsWith(format.bgLyricPrefix)).toBe(true);
		expect(rows[1]).toContain("Hold");
	});

	it("keeps translation rows in step and untouched", () => {
		const lyrics = lyricsOf([
			{ words: ["One"], translatedLyric: "Uno (sí)" },
			{ words: ["Two"], translatedLyric: "Dos" },
		]);
		const format = editTextFormat(lyrics);
		const text = "hello  there (yeah)\nUno (sí)\nTwo\nDos";
		const rows = processTextRows(text, format, STEPS, null).split("\n");
		expect(rows).toHaveLength(4);
		expect(rows[1]).toBe("Uno (sí)");
		expect(rows[3]).toBe("Dos");
		expect(rows[0]).not.toContain("  ");
	});

	it("only touches the picked lines", () => {
		const lyrics = lyricsOf([{ words: ["a"] }, { words: ["b"] }]);
		const format = editTextFormat(lyrics);
		const text = "first  line\nsecond  line";
		const rows = processTextRows(text, format, STEPS, { from: 1, to: 1 }).split(
			"\n",
		);
		expect(rows[0]).toBe("first  line");
		expect(rows[1]).not.toContain("  ");
	});

	it("picks a lyric line when only its translation row is selected", () => {
		const lyrics = lyricsOf([{ words: ["One"], translatedLyric: "Uno" }]);
		const format = editTextFormat(lyrics);
		const rows = processTextRows("a  b\nUno", format, STEPS, {
			from: 1,
			to: 1,
		}).split("\n");
		expect(rows[0]).not.toContain("  ");
	});

	it("leaves empty lines and section headers as they are", () => {
		const lyrics = lyricsOf([{ words: [] }]);
		const format = editTextFormat(lyrics);
		const text = `[Chorus]\n${format.wordSeparator}\n${format.bgLyricPrefix}${format.wordSeparator}`;
		expect(processTextRows(text, format, STEPS, null)).toBe(text);
	});
});

describe("splitTextRows", () => {
	const splitWord = (word: string) =>
		word.length > 3 ? [word.slice(0, 2), word.slice(2)] : [word];

	it("only marks syllables on the picked lines", () => {
		const lyrics = lyricsOf([{ words: ["a"] }, { words: ["b"] }]);
		const format = editTextFormat(lyrics);
		const rows = splitTextRows("hello world\nhello world", format, splitWord, {
			from: 0,
			to: 0,
		}).split("\n");
		expect(rows[0]).toContain(`he${format.wordSeparator}llo`);
		expect(rows[1]).toBe("hello world");
	});

	it("splits everything with no selection", () => {
		const lyrics = lyricsOf([{ words: ["a"] }]);
		const format = editTextFormat(lyrics);
		expect(splitTextRows("hello", format, splitWord, null)).toBe(
			`he${format.wordSeparator}llo`,
		);
	});
});
