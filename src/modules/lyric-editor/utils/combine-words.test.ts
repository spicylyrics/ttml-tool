import { describe, expect, it } from "vitest";
import { type LyricWord, newLyricWord } from "$/types/ttml";
import {
	combineMatchingWordSequences,
	combineSelectedWords,
	getCombineWordSelection,
} from "./combine-words";

const word = (text: string, startTime: number, endTime: number): LyricWord => ({
	...newLyricWord(),
	word: text,
	startTime,
	endTime,
});

describe("combine words", () => {
	it("combines an adjacent selection with the existing timing behavior", () => {
		const words = [word("beau", 100, 200), word("tiful", 200, 400)];
		const selectedIds = new Set(words.map(({ id }) => id));

		const result = combineSelectedWords(words, selectedIds);

		expect(result).toHaveLength(1);
		expect(result[0]).toMatchObject({
			word: "beautiful",
			startTime: 100,
			endTime: 400,
		});
	});

	it("preserves the current non-adjacent one-off behavior", () => {
		const words = [
			word("one", 0, 100),
			word("middle", 100, 200),
			word("two", 200, 300),
		];
		const selectedIds = new Set([words[0].id, words[2].id]);

		expect(getCombineWordSelection(words, selectedIds)?.isContiguous).toBe(
			false,
		);
		expect(
			combineSelectedWords(words, selectedIds).map(({ word }) => word),
		).toEqual(["onetwo", "middle"]);
	});

	it("combines every exact consecutive sequence", () => {
		const target = [word("some", 0, 1), word("thing", 1, 2)];
		const words = [
			word("some", 10, 20),
			word("thing", 20, 40),
			word("else", 40, 50),
			word("some", 50, 60),
			word("thing", 60, 80),
		];

		const result = combineMatchingWordSequences(words, target, false);

		expect(result.map(({ word }) => word)).toEqual([
			"something",
			"else",
			"something",
		]);
		expect(result[0]).toMatchObject({ startTime: 10, endTime: 40 });
		expect(result[2]).toMatchObject({ startTime: 50, endTime: 80 });
	});

	it("uses Split Word normalization and preserves each occurrence's text", () => {
		const target = [word("“BEAU", 0, 1), word("TIFUL?”", 1, 2)];
		const words = [word("beau", 10, 20), word("tiful", 20, 30)];

		expect(combineMatchingWordSequences(words, target, false)).toBe(words);
		expect(
			combineMatchingWordSequences(words, target, true).map(({ word }) => word),
		).toEqual(["beautiful"]);
	});

	it("requires punctuation-only tokens to match exactly", () => {
		const target = [word("hello", 0, 1), word("!", 1, 2)];
		const words = [word("HELLO", 10, 20), word("?", 20, 30)];

		expect(combineMatchingWordSequences(words, target, true)).toBe(words);
	});

	it("combines overlapping candidates left-to-right without overlap", () => {
		const target = [word("ha", 0, 1), word("ha", 1, 2)];
		const words = [word("ha", 0, 1), word("ha", 1, 2), word("ha", 2, 3)];

		expect(
			combineMatchingWordSequences(words, target, false).map(
				({ word }) => word,
			),
		).toEqual(["haha", "ha"]);
	});
});

describe("combine words romanization", () => {
	const roman = (text: string, romanWord: string): LyricWord => ({
		...word(text, 0, 1),
		romanWord,
	});

	it("joins syllable romanizations directly", () => {
		const words = [roman("君", "ki"), roman("み", "mi")];
		const result = combineSelectedWords(
			words,
			new Set(words.map(({ id }) => id)),
		);
		expect(result[0].romanWord).toBe("kimi");
	});

	it("keeps one space across a word boundary", () => {
		const words = [roman("君 ", "kimi"), roman("と", "to")];
		expect(
			combineSelectedWords(words, new Set(words.map(({ id }) => id)))[0]
				.romanWord,
		).toBe("kimi to");

		const spaced = [roman("君", "kimi"), roman(" ", ""), roman("と", "to")];
		expect(
			combineSelectedWords(spaced, new Set(spaced.map(({ id }) => id)))[0]
				.romanWord,
		).toBe("kimi to");
	});

	it("skips missing romanizations without stray spaces", () => {
		const words = [roman("あ ", ""), roman("い", "i"), roman("う", "")];
		expect(
			combineSelectedWords(words, new Set(words.map(({ id }) => id)))[0]
				.romanWord,
		).toBe("i");
		const none = [roman("a", ""), roman("b", "")];
		expect(
			combineSelectedWords(none, new Set(none.map(({ id }) => id)))[0]
				.romanWord,
		).toBe("");
	});

	it("keeps romanization when combining matching sequences", () => {
		const target = [roman("ko", ""), roman("re", "")];
		const words = [roman("こ", "ko"), roman("れ", "re")];
		words[0].word = "ko";
		words[1].word = "re";
		expect(
			combineMatchingWordSequences(words, target, false)[0].romanWord,
		).toBe("kore");
	});
});
