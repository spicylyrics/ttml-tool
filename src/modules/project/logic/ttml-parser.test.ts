import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "../../../types/ttml";
import {
	appendParentBeforeNestedLines,
	separateTrailingWhitespace,
} from "./ttml-parser";

describe("separateTrailingWhitespace", () => {
	it("keeps timing, identity, metadata on the trimmed syllable", () => {
		const word = {
			...newLyricWord(),
			word: " hello  \t",
			startTime: 100,
			endTime: 400,
			obscene: true,
			emptyBeat: 2,
			romanWord: "he-lo",
		};
		const [syllable, spaces] = separateTrailingWhitespace([word]);
		expect(syllable).toEqual({ ...word, word: " hello" });
		expect(spaces).toEqual({ ...newLyricWord(), id: spaces.id, word: "  \t" });
		expect(spaces.id).not.toBe(word.id);
		expect(word.word).toBe(" hello  \t");
	});

	it("preserves whitespace-only spans and words without trailing whitespace", () => {
		const words = [
			{ ...newLyricWord(), word: "  ", startTime: 100, endTime: 200 },
			{ ...newLyricWord(), word: "hello" },
			newLyricWord(),
		];
		expect(separateTrailingWhitespace(words)).toEqual(words);
	});

	it("splits Unicode whitespace and remains stable when applied again", () => {
		const words = separateTrailingWhitespace([
			{ ...newLyricWord(), word: "hello\u00a0\u3000" },
		]);
		expect(words.map((word) => word.word)).toEqual(["hello", "\u00a0\u3000"]);
		expect(separateTrailingWhitespace(words)).toEqual(words);
		expect(new Set(words.map((word) => word.id)).size).toBe(words.length);
	});

	it("handles a huge whitespace run before text in linear time", () => {
		// A backtracking /\s+$/ takes minutes on this input.
		const word = { ...newLyricWord(), word: `a${" ".repeat(200_000)}b  ` };
		const words = separateTrailingWhitespace([word]);
		expect(words.map((w) => w.word)).toEqual([
			`a${" ".repeat(200_000)}b`,
			"  ",
		]);
	});
});

describe("appendParentBeforeNestedLines", () => {
	it("keeps every nested background line after its parent", () => {
		const existing = { ...newLyricLine(), id: "existing" };
		const parent = { ...newLyricLine(), id: "main" };
		parent.words = [{ ...newLyricWord(), word: "Main" }];
		const lines = [
			existing,
			{ ...newLyricLine(), id: "bg-1", isBG: true },
			{ ...newLyricLine(), id: "bg-2", isBG: true },
			{ ...newLyricLine(), id: "bg-3", isBG: true },
		];

		appendParentBeforeNestedLines(lines, 1, parent);

		expect(lines.map((line) => line.id)).toEqual([
			"existing",
			"main",
			"bg-1",
			"bg-2",
			"bg-3",
		]);
	});

	it("does not create an empty parent for a standalone background line", () => {
		const parent = { ...newLyricLine(), id: "empty-main" };
		const lines = [{ ...newLyricLine(), id: "standalone-bg", isBG: true }];

		appendParentBeforeNestedLines(lines, 0, parent);

		expect(lines.map((line) => line.id)).toEqual(["standalone-bg"]);
	});
});
