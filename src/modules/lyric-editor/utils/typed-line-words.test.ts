import { describe, expect, it } from "vitest";
import { typedLineToWords } from "./typed-line-words";

const none = new Map<string, number[]>();

describe("typedLineToWords", () => {
	it("splits a typed line at spaces and keeps the spaces as words", () => {
		expect(typedLineToWords("Hello world, it's me", none)).toEqual([
			"Hello",
			" ",
			"world,",
			" ",
			"it's",
			" ",
			"me",
		]);
	});

	it("matches the import for split marks and hyphens", () => {
		expect(typedLineToWords("beau\\ti\\ful la-la", none)).toEqual([
			"beau",
			"ti",
			"ful",
			" ",
			"la-",
			"la",
		]);
	});

	it("applies learned splits, ignoring case and edge punctuation", () => {
		const rules = new Map([["beautiful", [4, 6]]]);
		expect(typedLineToWords("So Beautiful!", rules)).toEqual([
			"So",
			" ",
			"Beau",
			"ti",
			"ful!",
		]);
	});

	it("lets split marks win over a learned split", () => {
		const rules = new Map([["beautiful", [4, 6]]]);
		expect(typedLineToWords("beauti\\ful", rules)).toEqual(["beauti", "ful"]);
	});

	it("keeps a single word, a blank and an empty entry as they are", () => {
		expect(typedLineToWords("word", none)).toEqual(["word"]);
		expect(typedLineToWords(" ", none)).toEqual([" "]);
		expect(typedLineToWords("", none)).toEqual([""]);
	});

	it("never changes the typed text", () => {
		const rules = new Map([["again", [1]]]);
		const text = "  Oh -- (yeah) again  ";
		expect(typedLineToWords(text, rules).join("")).toBe(text);
	});
});
