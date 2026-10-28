import { describe, expect, it } from "vitest";
import type { SegmentationConfig } from "$/modules/segmentation/types";
import { createLearnedRule } from "$/modules/segmentation/utils/learned-rules";
import { DEFAULT_IMPORT_TEXT_FORMAT as FORMAT } from "./import-text";
import { keepWhole, overSplit } from "./over-split-fixtures";
import { splitImportText, splitWordForImport } from "./split-import-text";

const config = (
	overrides: Partial<SegmentationConfig> = {},
): SegmentationConfig => ({
	engine: "prosodic",
	splitCJK: true,
	splitEnglish: true,
	punctuationWeight: 0.2,
	punctuationMode: "merge",
	removeEmptySegments: true,
	ignoreList: new Set(),
	customRules: new Map(),
	learnedRules: new Map(),
	...overrides,
});

describe("splitImportText", () => {
	it("marks syllables with the word separator and keeps the text", () => {
		const text = "[Verse 1]\nBaby, everything\n\n<Ooh yeah";
		const result = splitImportText(text, FORMAT, config());
		expect(result).toBe(
			"[Verse 1]\nBa\\by,\\ \\e\\very\\thing\n\n<Ooh\\ \\yeah",
		);
		expect(result.split("\\").join("")).toBe(text);
	});

	it("doesn't split twice", () => {
		const once = splitImportText("Baby, everything", FORMAT, config());
		expect(splitImportText(once, FORMAT, config())).toBe(once);
	});

	it("leaves words the user already marked", () => {
		expect(splitImportText("ever\\ything", FORMAT, config())).toBe(
			"ever\\ything",
		);
	});

	it("applies learned splits before the engine", () => {
		const rule = createLearnedRule("everything", [5]);
		if (!rule) throw new Error("Expected a learned rule");
		const learned = config({
			learnedRules: new Map([[rule.key, rule.boundaries]]),
		});
		expect(splitImportText("Everything", FORMAT, learned)).toBe("Every\\thing");
	});

	it("uses the separator from the text format", () => {
		expect(
			splitImportText("baby", { ...FORMAT, wordSeparator: "/" }, config()),
		).toBe("ba/by");
	});

	it("returns the text as is without a word separator", () => {
		expect(
			splitImportText("baby", { ...FORMAT, wordSeparator: "" }, config()),
		).toBe("baby");
	});
});

// Reasoned over-split cases (R58). Collect real examples before tuning.
describe("over-splitting fixtures", () => {
	it.each(keepWhole)("keeps $word whole", ({ word, expected }) => {
		expect(splitWordForImport(word, config())).toEqual(expected);
	});

	it.each(overSplit)("still splits $word as recorded", ({ word, current }) => {
		expect(splitWordForImport(word, config())).toEqual(current);
	});

	// Expected to fail today. When one passes, the engine was fixed: move the
	// case to `keepWhole` (or drop its `current`).
	it.fails.each(overSplit)("splits $word as it should", ({
		word,
		expected,
	}) => {
		expect(splitWordForImport(word, config())).toEqual(expected);
	});
});
