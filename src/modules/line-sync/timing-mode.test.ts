import { describe, expect, it } from "vitest";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import {
	clampToSyncedLineBounds,
	getTimingMode,
	hasWordStructure,
	hasWordTimings,
	isLineBlock,
	keepLineBlocks,
	splitLineText,
	switchToLineMode,
	switchToWordMode,
	toLineBlock,
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

const texts = (target: LyricLine) => target.words.map((w) => w.word);

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

describe("toLineBlock", () => {
	it("joins the words into one token timed like the line", () => {
		const source = line(
			"a",
			[word("sun", 100, 200), word("shine", 200, 400), word(" "), word("day")],
			100,
			900,
		);
		const block = toLineBlock(source);
		expect(texts(block)).toEqual(["sunshine day"]);
		expect(block.words[0]).toMatchObject({ startTime: 100, endTime: 900 });
		expect(block.words[0].id).toBe(source.words[0].id);
		expect(block.isLineSynced).toBe(true);
		expect(isLineBlock(block)).toBe(true);
	});

	it("moves word romanizations to the line when it has none", () => {
		const source = line(
			"a",
			[
				{ ...word("君"), romanWord: "kimi" },
				{ ...word("が"), romanWord: "ga" },
			],
			0,
			1000,
		);
		const block = toLineBlock(source);
		expect(block.romanLyric).toBe("kimi ga");
		expect(block.words[0].romanWord).toBe("");
	});

	it("returns a line that already is a block unchanged", () => {
		const block = toLineBlock(
			line("a", [word("Hi"), word(" "), word("there")], 0, 500),
		);
		expect(toLineBlock(block)).toBe(block);
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

	it("turns every line into one block with its bounds", () => {
		expect(hasWordTimings(wordTimed)).toBe(true);
		expect(hasWordStructure(wordTimed)).toBe(true);
		const result = switchToLineMode(wordTimed);
		const [first] = result.lyricLines;
		expect(result.timingMode).toBe("line");
		expect(texts(first)).toEqual(["Hello world"]);
		expect(first).toMatchObject({
			startTime: 1000,
			endTime: 2200,
			isLineSynced: true,
		});
		expect(first.words[0]).toMatchObject({ startTime: 1000, endTime: 2200 });
		expect(hasWordTimings(result)).toBe(false);
		expect(hasWordStructure(result)).toBe(false);
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

	it("has nothing to lose on a song of one-word lines", () => {
		const song = lyric([line("a", [word("Hey")], 0, 0)]);
		expect(hasWordStructure(song)).toBe(false);
		expect(hasWordTimings(song)).toBe(false);
	});
});

describe("switchToWordMode", () => {
	const lineTimed = switchToLineMode(
		lyric([
			line(
				"a",
				[word("Hello"), word(" "), word("big"), word(" "), word("world")],
				1000,
				2000,
			),
			line("b", [word("Untimed line")], 0, 0),
		]),
	);

	it("splits each block at spaces and leaves words untimed by default", () => {
		const result = switchToWordMode(lineTimed);
		const [first, second] = result.lyricLines;
		expect(result.timingMode).toBeUndefined();
		expect(texts(first)).toEqual(["Hello", " ", "big", " ", "world"]);
		expect(first).toMatchObject({
			startTime: 1000,
			endTime: 2000,
			isLineSynced: false,
			syncedLineBounds: { startTime: 1000, endTime: 2000 },
		});
		expect(first.words.every((w) => w.startTime === 0 && w.endTime === 0)).toBe(
			true,
		);
		expect(first.words[0].id).toBe(lineTimed.lyricLines[0].words[0].id);
		expect(second.syncedLineBounds).toBeUndefined();
	});

	it("spreads a timed line's time across its words by letter count", () => {
		const [first, second] = switchToWordMode(lineTimed, {
			spread: true,
		}).lyricLines;
		const sung = first.words.filter((w) => w.word.trim());
		expect(sung.map((w) => [w.word, w.startTime, w.endTime])).toEqual([
			["Hello", 1000, 1385],
			["big", 1385, 1615],
			["world", 1615, 2000],
		]);
		expect(first).toMatchObject({ startTime: 1000, endTime: 2000 });
		expect(
			second.words.every((w) => w.startTime === 0 && w.endTime === 0),
		).toBe(true);
	});

	it("keeps a one-word line line-synced, as before Line mode existed", () => {
		const oneWord = switchToLineMode(
			lyric([line("a", [word("Hey")], 1000, 2000)]),
		);
		const [first] = switchToWordMode(oneWord).lyricLines;
		expect(first.isLineSynced).toBe(true);
	});
});

describe("splitLineText", () => {
	it("splits text into words and spaces that carry the given time", () => {
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
});

describe("keepLineBlocks", () => {
	const song = switchToLineMode(
		lyric([line("a", [word("One line")], 1000, 2000)]),
	);

	it("leaves Word-mode songs and intact blocks alone", () => {
		const wordSong = lyric([line("a", [word("a"), word("b")], 0, 0)]);
		expect(keepLineBlocks(wordSong, wordSong)).toBe(wordSong);
		expect(keepLineBlocks(song, song)).toBe(song);
	});

	it("joins a line that gained words back into one block", () => {
		const [block] = song.lyricLines;
		const split = {
			...song,
			lyricLines: [
				{ ...block, words: [word("One", 1000, 1400), word(" "), word("line")] },
			],
		};
		const [kept] = keepLineBlocks(song, split).lyricLines;
		expect(texts(kept)).toEqual(["One line"]);
		expect(kept.words[0]).toMatchObject({ startTime: 1000, endTime: 2000 });
	});

	it("adds a space before a word appended to a block", () => {
		const [block] = song.lyricLines;
		const appended = {
			...song,
			lyricLines: [
				{ ...block, words: [...block.words, word("again"), word("")] },
			],
		};
		const [kept] = keepLineBlocks(song, appended).lyricLines;
		expect(texts(kept)).toEqual(["One line again"]);
	});

	it("moves the line with its block when only the block was moved", () => {
		const [block] = song.lyricLines;
		const moved = {
			...song,
			lyricLines: [
				{
					...block,
					words: [{ ...block.words[0], startTime: 1500, endTime: 2600 }],
				},
			],
		};
		const [kept] = keepLineBlocks(song, moved).lyricLines;
		expect(kept).toMatchObject({ startTime: 1500, endTime: 2600 });
	});

	it("moves the block with its line when the line was moved", () => {
		const [block] = song.lyricLines;
		const moved = {
			...song,
			lyricLines: [{ ...block, startTime: 500, endTime: 1500 }],
		};
		const [kept] = keepLineBlocks(song, moved).lyricLines;
		expect(kept.words[0]).toMatchObject({ startTime: 500, endTime: 1500 });
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
