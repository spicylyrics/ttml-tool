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
		words: l.words.map((w) => w.word),
		startTime: l.startTime,
		endTime: l.endTime,
		isBG: l.isBG,
		isDuet: l.isDuet,
	}));

describe("shouldExportAsLineSynced", () => {
	it("writes a block as text and a line of words as spans", () => {
		expect(
			shouldExportAsLineSynced({
				...line([word("Whole line")], 0, 1000),
				isLineSynced: true,
			}),
		).toBe(true);
		expect(
			shouldExportAsLineSynced({
				...line([word("a"), word(" "), word("b")], 0, 1000),
				isLineSynced: true,
			}),
		).toBe(false);
	});
});

describe("Line-mode export", () => {
	const xml = exportTTMLText(lineTimed);

	it("marks the root as Line timed and stores the mode", () => {
		expect(xml).toContain('itunes:timing="Line"');
		expect(xml).toContain('key="amll:timingMode" value="line"');
	});

	it("writes lines and background lines as plain text", () => {
		expect(xml).toContain(
			'<p begin="00:01.000" end="00:02.200" ttm:agent="v1" itunes:key="L1">Hello world<span ttm:role="x-bg" begin="00:02.000" end="00:02.400">(ooh)</span></p>',
		);
		expect(xml).not.toMatch(/<span begin=/);
	});

	it("round-trips to the same blocks and timings", () => {
		const parsed = parseLyric(xml);
		expect(parsed.timingMode).toBe("line");
		expect(parsed.metadata.some((m) => m.key === "amll:timingMode")).toBe(
			false,
		);
		expect(summary(parsed)).toEqual(summary(lineTimed));
		expect(parsed.lyricLines.every((l) => l.isLineSynced)).toBe(true);
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
			syncedLineBounds: { startTime: 1000, endTime: 2200 },
		});
	});

	it("exports a song switched back to Word mode without a stored mode", () => {
		const out = exportTTMLText(switchToWordMode(lineTimed));
		expect(out).not.toContain("amll:timingMode");
	});
});

describe("line-timed files from elsewhere", () => {
	const ttml = (body: string) =>
		`<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Line"><body><div>${body}</div></body></tt>`;

	it("open in Line mode when every line is plain text", () => {
		const parsed = parseLyric(
			ttml(
				'<p begin="00:01.000" end="00:02.000">First line</p><p begin="00:02.000" end="00:03.000">Second line</p>',
			),
		);
		expect(parsed.timingMode).toBe("line");
		expect(parsed.lyricLines.map((l) => l.words.map((w) => w.word))).toEqual([
			["First line"],
			["Second line"],
		]);
	});

	it("stay in Word mode when a line has timed words", () => {
		const parsed = parseLyric(
			ttml(
				'<p begin="00:01.000" end="00:02.000"><span begin="00:01.000" end="00:01.500">First</span> <span begin="00:01.500" end="00:02.000">line</span></p>',
			),
		);
		expect(parsed.timingMode).toBeUndefined();
	});
});

describe("projects without a timing mode", () => {
	it("load as Word mode and export exactly as before", () => {
		const xml = exportTTMLText(wordTimed);
		expect(xml).not.toContain("amll:timingMode");
		expect(xml).toContain('itunes:timing="Word"');
		const parsed = parseLyric(xml);
		expect(parsed.timingMode).toBeUndefined();
		expect(parsed.lyricLines.some((l) => l.syncedLineBounds)).toBe(false);
	});
});
