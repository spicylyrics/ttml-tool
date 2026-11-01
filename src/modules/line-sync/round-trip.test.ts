// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import exportTTMLText from "$/modules/project/logic/ttml-writer";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";

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

const song = (lyricLines: LyricLine[]): TTMLLyric => ({
	metadata: [],
	lyricLines,
});

/** Lines timed with the line keys: start and end only, words untimed. */
const lineTimed = song([
	line([word("Hello"), word(" "), word("world")], 1000, 2200),
	line([word("ooh")], 2000, 2400, { isBG: true }),
	line([word("Second"), word(" "), word("line")], 2500, 4000, {
		isDuet: true,
	}),
]);

const summary = (lyric: TTMLLyric) =>
	lyric.lyricLines.map((l) => ({
		text: l.words.map((w) => w.word).join(""),
		startTime: l.startTime,
		endTime: l.endTime,
		isBG: l.isBG,
		isDuet: l.isDuet,
	}));

describe("a song with no word timing exports line-timed", () => {
	const xml = exportTTMLText(lineTimed);

	it("marks the root Line and writes each line as plain text", () => {
		expect(xml).toContain('itunes:timing="Line"');
		expect(xml).toContain(
			'<p begin="00:01.000" end="00:02.200" ttm:agent="v1" itunes:key="L1">Hello world<span ttm:role="x-bg" begin="00:02.000" end="00:02.400">(ooh)</span></p>',
		);
		expect(xml).not.toMatch(/<span begin=/);
	});

	it("round-trips to the same lines and timings", () => {
		const parsed = parseLyric(xml);
		expect(summary(parsed)).toEqual(summary(lineTimed));
		expect(parsed.lyricLines.every((l) => l.isLineSynced)).toBe(true);
		expect(exportTTMLText(parsed)).toBe(xml);
	});

	it("keeps lines that came from LRC or line-synced TTML line-timed", () => {
		const lrc = song([
			line([word("First line", 1000, 2000)], 1000, 2000, {
				isLineSynced: true,
			}),
			line([word("Second line", 2000, 3000)], 2000, 3000, {
				isLineSynced: true,
			}),
		]);
		expect(exportTTMLText(lrc)).toContain('itunes:timing="Line"');
	});

	it("opens a line-timed file from elsewhere and saves it the same way", () => {
		const ttml = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Line"><body><div><p begin="00:01.000" end="00:02.000">First line</p><p begin="00:02.000" end="00:03.000">Second line</p></div></body></tt>`;
		const out = exportTTMLText(parseLyric(ttml));
		expect(out).toContain('itunes:timing="Line"');
		expect(out).toContain(">First line</p>");
	});
});

describe("a song with any word timing exports Word", () => {
	it("when words are timed", () => {
		const timed = song([
			line(
				[word("Hello", 1000, 1500), word(" "), word("world", 1500, 2200)],
				1000,
				2200,
			),
		]);
		expect(exportTTMLText(timed)).toContain('itunes:timing="Word"');
	});

	it("when lines are one timed word each", () => {
		const oneWord = song([
			line([word("Hey", 1000, 1500)], 1000, 1500),
			line([word("You", 2000, 2500)], 2000, 2500),
		]);
		expect(exportTTMLText(oneWord)).toContain('itunes:timing="Word"');
	});

	it("when the song is mixed, with its line-only lines written as text", () => {
		const mixed = song([
			line(
				[word("Hello", 1000, 1400), word(" "), word("there", 1400, 2000)],
				1000,
				2000,
			),
			line([word("Second"), word(" "), word("line")], 2000, 3000),
		]);
		const xml = exportTTMLText(mixed);
		expect(xml).toContain('itunes:timing="Word"');
		expect(xml).toContain(
			'<p begin="00:02.000" end="00:03.000" ttm:agent="v1" itunes:key="L2">Second line</p>',
		);
	});
});

describe("a one-word line timed as a whole decides nothing", () => {
	it("so it joins a line-timed song as Line", () => {
		const lyric = song([
			line([word("Yeah", 1000, 1500)], 1000, 1500),
			line([word("Second"), word(" "), word("line")], 2000, 3000),
		]);
		expect(exportTTMLText(lyric)).toContain('itunes:timing="Line"');
	});

	it("and joins a word-timed song as Word", () => {
		const lyric = song([
			line([word("Yeah", 1000, 1500)], 1000, 1500, { isLineSynced: true }),
			line(
				[word("Hello", 2000, 2400), word(" "), word("there", 2400, 3000)],
				2000,
				3000,
			),
		]);
		expect(exportTTMLText(lyric)).toContain('itunes:timing="Word"');
	});
});

describe("an untimed song", () => {
	it("exports None, as before", () => {
		const untimed = song([line([word("Hey"), word(" "), word("you")], 0, 0)]);
		expect(exportTTMLText(untimed)).toContain('itunes:timing="None"');
	});
});
