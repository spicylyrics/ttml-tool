// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import { type LyricWord, newLyricLine, newLyricWord } from "$/types/ttml";
import hyphens from "./fixtures/hyphens.ttml?raw";
import splitSyllables from "./fixtures/split-syllables.ttml?raw";
import {
	type JoinedLyricWord,
	joinSplitWords,
	joinSplitWordsInLines,
	remapToJoinedWords,
	sourceWordIds,
} from "./join-split-words";
import { buildSpicyLines, groupSpicyTokens } from "./model";

const w = (
	word: string,
	startTime: number,
	endTime: number,
	romanWord = "",
): LyricWord => ({
	...newLyricWord(),
	id: `${word}@${startTime}`,
	word,
	startTime,
	endTime,
	romanWord,
});
const space = (at: number) => w(" ", at, at);
const texts = (words: LyricWord[]) => words.map((word) => word.word);

describe("joinSplitWords", () => {
	it("joins the evenly paced parts of a word into one syllable", () => {
		const parts = [w("un", 0, 200), w("der", 200, 500)];
		const [joined, ...rest] = joinSplitWords(parts);
		expect(rest).toEqual([]);
		expect(joined).toMatchObject({
			id: parts[0].id,
			word: "under",
			startTime: 0,
			endTime: 500,
		});
	});

	it("keeps the first part's id and lists every part's id", () => {
		const parts = [w("Beau", 0, 300), w("ti", 300, 500), w("ful", 500, 800)];
		const [joined] = joinSplitWords(parts) as JoinedLyricWord[];
		expect(joined.id).toBe(parts[0].id);
		expect(joined.joinedIds).toEqual(parts.map((part) => part.id));
		expect(sourceWordIds(joined)).toEqual(parts.map((part) => part.id));
		// A word that wasn't joined stands for itself only.
		const [single] = joinSplitWords([w("one", 0, 200)]) as JoinedLyricWord[];
		expect(single.joinedIds).toBeUndefined();
		expect(sourceWordIds(single)).toEqual([single.id]);
		// Every part is still found through a lookup keyed by editor word id.
		const marked = new Map([[parts[1].id, "problem"]]);
		expect(sourceWordIds(joined).some((id) => marked.has(id))).toBe(true);
	});

	it("gives a joined word every value its parts had", () => {
		const parts = [w("Beau", 0, 300), w("ti", 300, 500), w("ful", 500, 800)];
		const line = { ...newLyricLine(), words: parts };
		const [joinedLine] = joinSplitWordsInLines([line]);
		const byWordId = new Map([
			[parts[1].id, ["a"]],
			[parts[2].id, ["a", "b"]],
		]);
		const remapped = remapToJoinedWords([joinedLine], byWordId);
		expect(joinedLine.words).toHaveLength(1);
		expect(remapped.get(parts[0].id)).toEqual(["a", "b"]);
		// Unjoined words keep their own entries.
		expect(remapToJoinedWords([line], byWordId)).toEqual(byWordId);
	});

	it("never joins across a space between words", () => {
		const words = [
			w("hel", 0, 200),
			w("lo", 200, 400),
			space(400),
			w("wor", 400, 600),
			w("ld", 600, 800),
		];
		expect(texts(joinSplitWords(words))).toEqual(["hello", " ", "world"]);
	});

	it("ends a word at a comma or at whitespace inside a span", () => {
		expect(
			texts(joinSplitWords([w("one,", 0, 200), w("two", 200, 400)])),
		).toEqual(["one,", "two"]);
		expect(
			texts(joinSplitWords([w("one ", 0, 200), w("two", 200, 400)])),
		).toEqual(["one ", "two"]);
		expect(
			texts(joinSplitWords([w("one", 0, 200), w(" two", 200, 400)])),
		).toEqual(["one", " two"]);
	});

	it("keeps a run's outer space and comma so the word edges survive", () => {
		const words = [w(" Beau", 0, 300), w("ti", 300, 500), w("ful, ", 500, 800)];
		expect(texts(joinSplitWords(words))).toEqual([" Beautiful, "]);
	});

	it("joins across a silence of up to 100ms and no longer", () => {
		expect(texts(joinSplitWords([w("ba", 0, 200), w("by", 300, 500)]))).toEqual(
			["baby"],
		);
		expect(texts(joinSplitWords([w("ba", 0, 200), w("by", 301, 500)]))).toEqual(
			["ba", "by"],
		);
	});

	it("keeps a part sung over three times off the word's pace split", () => {
		// "a" gets half the time for a seventh of the letters.
		const uneven = [w("a", 0, 100), w("bcdefg", 100, 200)];
		expect(joinSplitWords(uneven)).toBe(uneven);
		// Slightly uneven is still one steady fill.
		expect(texts(joinSplitWords([w("lo", 0, 300), w("ve", 300, 500)]))).toEqual(
			["love"],
		);
	});

	it("keeps the whole word split when any of its parts fails", () => {
		const words = [w("Beau", 0, 300), w("ti", 300, 500), w("ful", 900, 1200)];
		expect(texts(joinSplitWords(words))).toEqual(["Beau", "ti", "ful"]);
	});

	it("keeps parts split at a dash, but not a dash on the last part", () => {
		expect(
			texts(
				joinSplitWords([
					w("Ah-", 0, 300),
					w("ah-", 300, 600),
					w("ah", 600, 900),
				]),
			),
		).toEqual(["Ah-", "ah-", "ah"]);
		expect(
			texts(joinSplitWords([w("un-", 0, 300), w("der", 300, 600)])),
		).toEqual(["un-", "der"]);
		// En dash and horizontal bar count too; the hyphen-minus range ends at U+2015.
		expect(
			texts(joinSplitWords([w("la–", 0, 300), w("la", 300, 600)])),
		).toEqual(["la–", "la"]);
		expect(
			texts(joinSplitWords([w("la―", 0, 300), w("la", 300, 600)])),
		).toEqual(["la―", "la"]);
		expect(
			texts(joinSplitWords([w("re", 0, 300), w("do-", 300, 600)])),
		).toEqual(["redo-"]);
	});

	it("keeps scripts written without spaces as they were timed", () => {
		const japanese = [w("さ", 0, 300), w("く", 300, 600), w("ら", 600, 900)];
		expect(joinSplitWords(japanese)).toBe(japanese);
		const thai = [w("สวัส", 0, 300), w("ดี", 300, 500)];
		expect(joinSplitWords(thai)).toBe(thai);
		// Hangul is spaced, so it joins.
		expect(texts(joinSplitWords([w("사", 0, 300), w("랑", 300, 600)]))).toEqual(
			["사랑"],
		);
	});

	it("joins the romanization too, falling back to a part's own text", () => {
		const [joined] = joinSplitWords([w("ко", 0, 300, "ko"), w("т", 300, 500)]);
		expect(joined).toMatchObject({ word: "кот", romanWord: "koт" });
		const [plain] = joinSplitWords([w("ba", 0, 200), w("by", 200, 400)]);
		expect(plain.romanWord).toBe("");
	});

	it("keeps parts split when a romanization holds a space", () => {
		const words = [w("ab", 0, 200, "a b"), w("cd", 200, 400, "cd")];
		expect(joinSplitWords(words)).toBe(words);
	});

	it("measures a background vocal without its parentheses", () => {
		// "(o" counts as one letter, so it is not too fast for its share.
		const words = [w("(o", 0, 100), w("oooh)", 100, 600)];
		expect(texts(joinSplitWords(words, true))).toEqual(["(ooooh)"]);
	});

	it("returns the same array when nothing joins", () => {
		const words = [w("one", 0, 200), space(200), w("two", 200, 400)];
		expect(joinSplitWords(words)).toBe(words);
	});

	it("joinSplitWordsInLines keeps untouched lines and arrays", () => {
		const still = {
			...newLyricLine(),
			words: [w("one", 0, 200), space(200), w("two", 200, 400)],
		};
		const lines = [still];
		expect(joinSplitWordsInLines(lines)).toBe(lines);

		const split = {
			...newLyricLine(),
			words: [w("ba", 0, 200), w("by", 200, 400)],
		};
		const result = joinSplitWordsInLines([still, split]);
		expect(result[0]).toBe(still);
		expect(texts(result[1].words)).toEqual(["baby"]);
		expect(texts(split.words)).toEqual(["ba", "by"]);
	});
});

describe("Join split words in the Spicy preview", () => {
	const groups = (ttml: string, join: boolean) => {
		const source = parseLyric(ttml).lyricLines;
		const [line] = buildSpicyLines(
			join ? joinSplitWordsInLines(source) : source,
			false,
			false,
		);
		return groupSpicyTokens(line.words).map((group) =>
			group.items.map(({ token }) => token.text),
		);
	};

	it("renders a split word as one word only with the setting on", () => {
		expect(groups(splitSyllables, false)[0]).toEqual(["Beau", "ti", "ful"]);
		expect(groups(splitSyllables, true)).toEqual([
			["Beautiful"],
			["one,"],
			["two"],
			["end"],
		]);
	});

	it("leaves hyphenated parts split either way", () => {
		expect(groups(hyphens, true)).toEqual(groups(hyphens, false));
	});

	it("gives a joined word held letters its parts were too short for", () => {
		const line = {
			...newLyricLine(),
			startTime: 0,
			endTime: 1200,
			words: [w("Sooo", 0, 600), w("ooon", 600, 1200)],
		};
		const [split] = buildSpicyLines([line], false, false);
		expect(split.words.every((word) => !word.letters)).toBe(true);
		const [joined] = buildSpicyLines(
			joinSplitWordsInLines([line]),
			false,
			false,
		);
		expect(joined.words).toHaveLength(1);
		expect(joined.words[0].letters).toEqual([..."Soooooon"]);
	});
});
