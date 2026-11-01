import { describe, expect, it } from "vitest";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
} from "$/types/ttml";
import { isLineTimedSong, lineHasWordTiming } from "./line-timing";
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
