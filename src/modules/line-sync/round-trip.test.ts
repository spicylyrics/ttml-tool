// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import exportTTMLText, {
	shouldExportAsLineSynced,
} from "$/modules/project/logic/ttml-writer";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import { switchToLineMode, switchToWordMode } from "./timing-mode";

const word = (text: string, startTime = 0, endTime = 0): LyricWord => ({
	...newLyricWord(),
	word: text,
	startTime,
	endTime,
});

const line = (
	words: LyricWord[],
	startTime: number,
	endTime: number,
	extra: Partial<LyricLine> = {},
): LyricLine => ({ ...newLyricLine(), words, startTime, endTime, ...extra });

const wordTimed: TTMLLyric = {
	metadata: [],
	lyricLines: [
		line(
			[word("Hello", 1000, 1500), word(" "), word("world", 1500, 2200)],
			1000,
			2200,
		),
		line([word("ooh", 2000, 2400)], 2000, 2400, { isBG: true }),
		line(
			[word("Second", 2500, 3000), word(" "), word("line", 3000, 4000)],
			2500,
			4000,
			{
				isDuet: true,
			},
		),
	],
};

const lineTimed = switchToLineMode(wordTimed);

const summary = (lyric: TTMLLyric) =>
	lyric.lyricLines.map((l) => ({
		text: l.words.map((w) => w.word).join(""),
		words: l.words.map((w) => w.word),
		startTime: l.startTime,
		endTime: l.endTime,
		isBG: l.isBG,
		isDuet: l.isDuet,
	}));

describe("shouldExportAsLineSynced with a timing mode", () => {
	const multiWord = line([word("a"), word(" "), word("b")], 0, 1000);

	it("writes every line as text in Line mode", () => {
		expect(shouldExportAsLineSynced(multiWord, "line")).toBe(true);
	});

	it("writes every line as words once switched back to Word mode", () => {
		expect(
			shouldExportAsLineSynced(
				{ ...line([word("Whole line")], 0, 1000), isLineSynced: true },
				"word",
			),
		).toBe(false);
	});

	it("keeps the old rule for projects without a mode", () => {
		expect(shouldExportAsLineSynced({ ...multiWord, isLineSynced: true })).toBe(
			false,
		);
		expect(
			shouldExportAsLineSynced({
				...line([word("Whole line")], 0, 1000),
				isLineSynced: true,
			}),
		).toBe(true);
	});
});

describe("Line-mode export", () => {
	const xml = exportTTMLText(lineTimed);

	it("marks the root as Line timed and stores the mode", () => {
		expect(xml).toContain('itunes:timing="Line"');
		expect(xml).toContain('key="amll:timingMode" value="line"');
	});

	it("writes multi-word lines and background lines as plain text", () => {
		expect(xml).toContain(
			'<p begin="00:01.000" end="00:02.200" ttm:agent="v1" itunes:key="L1">Hello world<span ttm:role="x-bg" begin="00:02.000" end="00:02.400">(ooh)</span></p>',
		);
		expect(xml).not.toMatch(/<span begin=/);
	});

	it("round-trips to the same lines, words and timings", () => {
		const parsed = parseLyric(xml);
		expect(parsed.timingMode).toBe("line");
		expect(parsed.metadata.some((m) => m.key === "amll:timingMode")).toBe(
			false,
		);
		expect(summary(parsed)).toEqual(summary(lineTimed));
		expect(
			parsed.lyricLines.every((l) => l.isLineSynced && l.lineBoundsSynced),
		).toBe(true);
		expect(exportTTMLText(parsed)).toBe(xml);
	});

	it("can switch a reopened Line-mode file back to Word mode with every word to sync", () => {
		const reopened = switchToWordMode(parseLyric(xml));
		expect(reopened.lyricLines[0].words.map((w) => w.word)).toEqual([
			"Hello",
			" ",
			"world",
		]);
		expect(reopened.lyricLines[0]).toMatchObject({
			startTime: 1000,
			endTime: 2200,
			lineBoundsSynced: true,
		});
	});
});

describe("projects without a timing mode", () => {
	it("load as Word mode and export exactly as before", () => {
		const xml = exportTTMLText(wordTimed);
		expect(xml).not.toContain("amll:timingMode");
		expect(xml).toContain('itunes:timing="Word"');
		const parsed = parseLyric(xml);
		expect(parsed.timingMode).toBeUndefined();
		expect(parsed.lyricLines.some((l) => l.lineBoundsSynced)).toBe(false);
	});
});
