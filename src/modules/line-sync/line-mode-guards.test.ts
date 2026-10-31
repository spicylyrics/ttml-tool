// @vitest-environment jsdom
import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
	editTextFormat,
	serializeLyrics,
} from "$/modules/edit-as-text/logic/serialize";
import { applyEditedText } from "$/modules/edit-as-text/logic/text-diff";
import { lyricLinesAtom } from "$/states/main";
import {
	type LyricLine,
	type LyricWord,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import { asSpicyLineTimed, hasHiddenLineTimedVocals } from "./spicy-preview";
import { switchToLineMode } from "./timing-mode";

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

const song: TTMLLyric = switchToLineMode({
	metadata: [],
	lyricLines: [
		line([word("First"), word(" "), word("line")], 1000, 2000),
		line([word("Second"), word(" "), word("line")], 2000, 3000),
	],
});

describe("the open song in Line mode", () => {
	it("joins anything written into a line back into one block", () => {
		const store = createStore();
		store.set(lyricLinesAtom, song);
		store.set(lyricLinesAtom, (prev) => ({
			...prev,
			lyricLines: prev.lyricLines.map((target, index) =>
				index === 0
					? {
							...target,
							words: [word("Typed", 0, 0), word(" "), word("again")],
						}
					: target,
			),
		}));
		const [first, second] = store.get(lyricLinesAtom).lyricLines;
		expect(first.words.map((w) => w.word)).toEqual(["Typed again"]);
		expect(first.words[0]).toMatchObject({ startTime: 1000, endTime: 2000 });
		expect(second).toBe(song.lyricLines[1]);
	});

	it("leaves Word-mode songs exactly as written", () => {
		const store = createStore();
		const wordSong: TTMLLyric = {
			metadata: [],
			lyricLines: [line([word("a"), word(" "), word("b")], 0, 0)],
		};
		store.set(lyricLinesAtom, wordSong);
		expect(store.get(lyricLinesAtom)).toBe(wordSong);
	});
});

describe("Edit as text in Line mode", () => {
	const format = editTextFormat(song);

	it("writes one row per line", () => {
		expect(serializeLyrics(song, format)).toContain("First line\nSecond line");
	});

	it("keeps an edited line's timing and reports nothing lost", () => {
		const text = serializeLyrics(song, format).replace(
			"First line",
			"First line, edited",
		);
		const result = applyEditedText(song, text, format);
		expect(result.summary).toMatchObject({
			edited: 1,
			unchanged: 1,
			droppedTimedWords: 0,
		});
		const [first] = result.lyricLines;
		expect(first.words.map((w) => w.word)).toEqual(["First line, edited"]);
		expect(first).toMatchObject({ startTime: 1000, endTime: 2000 });
		expect(first.words[0]).toMatchObject({ startTime: 1000, endTime: 2000 });
	});

	it("reads word separators as part of the text, not as splits", () => {
		const text = serializeLyrics(song, format).replace(
			"First line",
			`Fi${format.wordSeparator}rst line`,
		);
		const [first] = applyEditedText(song, text, format).lyricLines;
		expect(first.words).toHaveLength(1);
	});
});

describe("Spicy preview of a line-timed song", () => {
	const lines = [
		line([word("Lead")], 0, 1000),
		line([word("ooh")], 0, 1000, { isBG: true }),
		line([word("Duet")], 1000, 2000, { isDuet: true }),
	];

	it("leaves out background vocals and puts every line on the lead side", () => {
		const shown = asSpicyLineTimed(lines);
		expect(shown.map((l) => l.words[0].word)).toEqual(["Lead", "Duet"]);
		expect(shown.every((l) => !l.isDuet)).toBe(true);
		expect(shown[0]).toBe(lines[0]);
	});

	it("says when anything is left out", () => {
		expect(hasHiddenLineTimedVocals(lines)).toBe(true);
		expect(hasHiddenLineTimedVocals([lines[0]])).toBe(false);
	});
});
