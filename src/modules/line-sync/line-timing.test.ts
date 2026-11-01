import { describe, expect, it } from "vitest";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
} from "$/types/ttml";
import {
	clearWordTiming,
	getSongTiming,
	isLineTimedSong,
	lineHasWordTiming,
	spreadLineOnlyLines,
} from "./line-timing";
import { asSpicyLineTimed, hasHiddenLineTimedVocals } from "./spicy-preview";

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

describe("isLineTimedSong", () => {
	it("is true when lines have times and no word does", () => {
		expect(
			isLineTimedSong([line([word("a"), word(" "), word("b")], 1000, 2000)]),
		).toBe(true);
	});

	it("ignores the one token of a line stored as text", () => {
		const block = line([word("Whole line", 1000, 2000)], 1000, 2000, {
			isLineSynced: true,
		});
		expect(lineHasWordTiming(block)).toBe(false);
		expect(isLineTimedSong([block])).toBe(true);
	});

	it("is false once any word is timed, or nothing is", () => {
		expect(isLineTimedSong([line([word("a", 1000, 1500)], 1000, 1500)])).toBe(
			false,
		);
		expect(isLineTimedSong([line([word("a")], 0, 0)])).toBe(false);
		expect(isLineTimedSong([])).toBe(false);
	});
});

describe("getSongTiming", () => {
	const lineOnly = line([word("Second"), word(" "), word("line")], 2000, 3000);
	const wordTimed = line(
		[word("Hello", 1000, 1400), word(" "), word("there", 1400, 2000)],
		1000,
		2000,
	);

	it("tells word, line, mixed and untimed songs apart", () => {
		expect(getSongTiming([wordTimed])).toBe("word");
		expect(getSongTiming([lineOnly])).toBe("line");
		expect(getSongTiming([wordTimed, lineOnly])).toBe("mixed");
		expect(getSongTiming([line([word("a")], 0, 0)])).toBe("none");
	});

	it("lets a one-word line timed as a whole go either way", () => {
		const yeah = line([word("Yeah", 500, 900)], 500, 900);
		expect(getSongTiming([yeah, wordTimed])).toBe("word");
		expect(getSongTiming([yeah, lineOnly])).toBe("line");
		// Untimed word with a line time: line-only, but still one word.
		const untimedYeah = line([word("Yeah")], 500, 900);
		expect(getSongTiming([untimedYeah, wordTimed])).toBe("word");
	});

	it("counts a one-word line as word timing once its word is timed apart from the line", () => {
		const held = line([word("Yeah", 500, 700)], 500, 900);
		expect(getSongTiming([held, lineOnly])).toBe("mixed");
	});
});

describe("Mixed fixes", () => {
	const wordTimed = line(
		[word("Hello", 1000, 1400), word(" "), word("there", 1400, 2000)],
		1000,
		2000,
	);
	const lineOnly = line([word("Big"), word(" "), word("world")], 2000, 2800);
	const block = line([word("Whole line", 3000, 4000)], 3000, 4000, {
		isLineSynced: true,
	});

	it("spreads line-only lines across their words, splitting text blocks", () => {
		const [, spread, split] = spreadLineOnlyLines([wordTimed, lineOnly, block]);
		expect(spread.words.map((w) => [w.word, w.startTime, w.endTime])).toEqual([
			["Big", 2000, 2300],
			[" ", 2300, 2300],
			["world", 2300, 2800],
		]);
		expect(split.isLineSynced).toBe(false);
		expect(split.words.map((w) => w.word)).toEqual(["Whole", " ", "line"]);
		expect(getSongTiming([wordTimed, spread, split])).toBe("word");
	});

	it("clears word timing and keeps line times", () => {
		const cleared = clearWordTiming([wordTimed, lineOnly]);
		expect(cleared[0]).toMatchObject({ startTime: 1000, endTime: 2000 });
		expect(cleared[0].words.every((w) => w.endTime === 0)).toBe(true);
		expect(cleared[1]).toBe(lineOnly);
		expect(getSongTiming(cleared)).toBe("line");
	});
});

describe("Spicy preview of a line-timed song", () => {
	const lead = line([word("Hello"), word(" "), word("world")], 1000, 2000);
	const duet = line([word("Duet")], 2000, 3000, { isDuet: true });
	const bg = line([word("ooh")], 1500, 1800, { isBG: true });

	it("shows each line as its text, leaves out background lines and duet sides", () => {
		const shown = asSpicyLineTimed([lead, bg, duet]);
		expect(shown.map((l) => l.words.map((w) => w.word))).toEqual([
			["Hello world"],
			["Duet"],
		]);
		expect(shown.every((l) => l.isLineSynced && !l.isDuet)).toBe(true);
		expect(shown[0].words[0]).toMatchObject({
			startTime: 1000,
			endTime: 2000,
		});
	});

	it("knows when the notice is needed", () => {
		expect(hasHiddenLineTimedVocals([lead])).toBe(false);
		expect(hasHiddenLineTimedVocals([lead, bg])).toBe(true);
		expect(hasHiddenLineTimedVocals([lead, duet])).toBe(true);
	});
});
