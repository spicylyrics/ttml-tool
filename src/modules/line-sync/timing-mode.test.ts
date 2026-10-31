import { describe, expect, it } from "vitest";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import {
	applyLrcTimingMode,
	clampToSyncedLineBounds,
	getTimingMode,
	hasWordTimings,
	restoreLineModeWords,
	splitLineText,
	switchToLineMode,
	switchToWordMode,
} from "./timing-mode";

const word = (text: string, startTime = 0, endTime = 0): LyricWord => ({
	...newLyricWord(),
	word: text,
	startTime,
	endTime,
});

const line = (
	id: string,
	words: LyricWord[],
	startTime: number,
	endTime: number,
	extra: Partial<LyricLine> = {},
): LyricLine => ({
	...newLyricLine(),
	id,
	words,
	startTime,
	endTime,
	...extra,
});

const lyric = (
	lyricLines: LyricLine[],
	extra: Partial<TTMLLyric> = {},
): TTMLLyric => ({ metadata: [], lyricLines, ...extra });

describe("getTimingMode", () => {
	it("reads projects saved without the field as word timed", () => {
		expect(getTimingMode(lyric([]))).toBe("word");
		expect(getTimingMode({})).toBe("word");
	});

	it("reads the stored mode", () => {
		expect(getTimingMode(lyric([], { timingMode: "line" }))).toBe("line");
		expect(getTimingMode(lyric([], { timingMode: "word" }))).toBe("word");
	});
});

describe("switchToLineMode", () => {
	const wordTimed = lyric([
		line(
			"a",
			[word("Hello", 1000, 1500), word(" "), word("world", 1500, 2200)],
			1000,
			2200,
		),
	]);

	it("keeps every word and the line bounds but drops word timing", () => {
		expect(hasWordTimings(wordTimed)).toBe(true);
		const result = switchToLineMode(wordTimed);
		const [first] = result.lyricLines;
		expect(result.timingMode).toBe("line");
		expect(first.words.map((w) => w.word)).toEqual(["Hello", " ", "world"]);
		expect(first).toMatchObject({
			startTime: 1000,
			endTime: 2200,
			isLineSynced: true,
			syncedLineBounds: { startTime: 1000, endTime: 2200 },
		});
		expect(first.words.map((w) => [w.startTime, w.endTime])).toEqual([
			[1000, 2200],
			[0, 0],
			[1000, 2200],
		]);
		expect(hasWordTimings(result)).toBe(false);
	});

	it("derives missing line bounds from timed words", () => {
		const result = switchToLineMode(
			lyric([line("a", [word("Hi", 300, 900)], 0, 0)]),
		);
		expect(result.lyricLines[0]).toMatchObject({
			startTime: 300,
			endTime: 900,
		});
	});

	it("does not mark untimed lines as synced", () => {
		const result = switchToLineMode(lyric([line("a", [word("Hi")], 0, 0)]));
		expect(result.lyricLines[0].syncedLineBounds).toBeUndefined();
	});
});

describe("switchToWordMode", () => {
	it("keeps line bounds as synced bounds and leaves every word untimed", () => {
		const lineTimed = switchToLineMode(
			lyric([line("a", [word("Hello"), word(" "), word("world")], 1000, 2000)]),
		);
		const result = switchToWordMode(lineTimed);
		const [first] = result.lyricLines;
		expect(result.timingMode).toBeUndefined();
		expect(first).toMatchObject({
			startTime: 1000,
			endTime: 2000,
			isLineSynced: false,
			syncedLineBounds: { startTime: 1000, endTime: 2000 },
		});
		expect(first.words.every((w) => w.startTime === 0 && w.endTime === 0)).toBe(
			true,
		);
	});

	it("keeps a one-word line line-synced, as before Line mode existed", () => {
		const lineTimed = switchToLineMode(
			lyric([line("a", [word("Hey")], 1000, 2000)]),
		);
		const [first] = switchToWordMode(lineTimed).lyricLines;
		expect(first.isLineSynced).toBe(true);
	});

	it("splits a line stored as one text token back into words", () => {
		const lineTimed = lyric(
			[
				line("a", [word("Line one", 0, 1000)], 0, 1000, {
					isLineSynced: true,
				}),
			],
			{ timingMode: "line" },
		);
		const [first] = switchToWordMode(lineTimed).lyricLines;
		expect(first.words.map((w) => w.word)).toEqual(["Line", " ", "one"]);
		expect(first.isLineSynced).toBe(false);
		expect(first.words.every((w) => w.startTime === 0 && w.endTime === 0)).toBe(
			true,
		);
	});
});

describe("splitLineText / restoreLineModeWords", () => {
	it("splits text into words and spaces that carry the line time", () => {
		expect(
			splitLineText("Hello  big world", 100, 900).map((w) => [
				w.word,
				w.startTime,
				w.endTime,
			]),
		).toEqual([
			["Hello", 100, 900],
			["  ", 0, 0],
			["big", 100, 900],
			[" ", 0, 0],
			["world", 100, 900],
		]);
	});

	it("only touches Line-mode documents", () => {
		const doc = lyric([
			line("a", [word("Hello world", 0, 1000)], 0, 1000, {
				isLineSynced: true,
			}),
		]);
		expect(restoreLineModeWords(doc)).toBe(doc);
		const restored = restoreLineModeWords({ ...doc, timingMode: "line" });
		expect(restored.lyricLines[0].words.map((w) => w.word)).toEqual([
			"Hello",
			" ",
			"world",
		]);
		expect(restored.lyricLines[0].syncedLineBounds).toEqual({
			startTime: 0,
			endTime: 1000,
		});
	});
});

describe("applyLrcTimingMode", () => {
	const lrc = lyric([
		line("a", [word("Line one", 0, 1000)], 0, 1000, { isLineSynced: true }),
	]);

	it("opens LRC imports in Line mode, split into words", () => {
		const result = applyLrcTimingMode(lrc);
		expect(result.timingMode).toBe("line");
		expect(result.lyricLines[0]).toMatchObject({
			startTime: 0,
			endTime: 1000,
			isLineSynced: true,
		});
		expect(result.lyricLines[0].words.map((w) => w.word)).toEqual([
			"Line",
			" ",
			"one",
		]);
	});

	it("splits LRC lines into separate words after switching to Word", () => {
		const [first] = switchToWordMode(applyLrcTimingMode(lrc)).lyricLines;
		expect(first.words.map((w) => w.word)).toEqual(["Line", " ", "one"]);
		expect(first.isLineSynced).toBe(false);
	});
});

describe("clampToSyncedLineBounds (R48)", () => {
	const bounded = (
		id: string,
		words: LyricWord[],
		start: number,
		end: number,
	) =>
		line(id, words, start, end, {
			syncedLineBounds: { startTime: start, endTime: end },
		});

	const setWord = (
		doc: TTMLLyric,
		lineIndex: number,
		wordIndex: number,
		patch: Partial<LyricWord>,
		linePatch: Partial<LyricLine> = {},
	): TTMLLyric => {
		const lines = doc.lyricLines.slice();
		const target = lines[lineIndex];
		const words = target.words.slice();
		words[wordIndex] = { ...words[wordIndex], ...patch };
		lines[lineIndex] = { ...target, ...linePatch, words };
		return { ...doc, lyricLines: lines };
	};

	const prev = lyric([
		bounded("a", [word("one"), word(" "), word("two")], 1000, 2000),
		bounded("b", [word("three"), word(" "), word("four")], 2500, 4000),
	]);

	it("stops applying once the line's times were edited another way", () => {
		// A typed or dragged line start leaves the recorded bounds behind.
		const edited = lyric([
			{ ...prev.lyricLines[0], startTime: 800 },
			prev.lyricLines[1],
		]);
		const next = setWord(edited, 0, 0, { startTime: 500 }, { startTime: 500 });
		expect(clampToSyncedLineBounds(edited, next)).toBe(next);
	});

	it("keeps a word's start inside the synced line", () => {
		const next = setWord(prev, 0, 0, { startTime: 500 }, { startTime: 500 });
		const result = clampToSyncedLineBounds(prev, next);
		expect(result.lyricLines[0].words[0].startTime).toBe(1000);
		expect(result.lyricLines[0].startTime).toBe(1000);
	});

	it("ends the last word at the line end when G lands past it and starts the next line inside its own bounds", () => {
		// G on "two" at 2300: word-mode G ends "two", ends line a, starts line b's first word.
		let next = setWord(prev, 0, 2, { endTime: 2300 }, { endTime: 2300 });
		next = setWord(next, 1, 0, { startTime: 2300 }, { startTime: 2300 });
		const result = clampToSyncedLineBounds(prev, next);
		expect(result.lyricLines[0].words[2].endTime).toBe(2000);
		expect(result.lyricLines[0].endTime).toBe(2000);
		expect(result.lyricLines[1].words[0].startTime).toBe(2500);
		expect(result.lyricLines[1].startTime).toBe(2500);
	});

	it("leaves words inside the bounds and lines without synced bounds untouched", () => {
		const free = lyric([line("a", [word("one")], 0, 0)]);
		const freeNext = setWord(free, 0, 0, { startTime: 500, endTime: 800 });
		expect(clampToSyncedLineBounds(free, freeNext)).toBe(freeNext);

		const inside = setWord(prev, 0, 0, { startTime: 1200 });
		const result = clampToSyncedLineBounds(prev, inside);
		expect(result.lyricLines[0].words[0]).toBe(inside.lyricLines[0].words[0]);
	});

	it("leaves untouched words alone even if they are outside the bounds", () => {
		const stale = lyric([
			bounded("a", [word("one", 100, 200), word("two")], 1000, 2000),
		]);
		const next = setWord(stale, 0, 1, { startTime: 1500 });
		const result = clampToSyncedLineBounds(stale, next);
		expect(result.lyricLines[0].words[0]).toBe(stale.lyricLines[0].words[0]);
	});
});
