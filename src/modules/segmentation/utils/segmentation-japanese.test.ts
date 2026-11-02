import { describe, expect, it } from "vitest";
import { newLyricWord } from "$/types/ttml";
import type { SegmentationConfig } from "../types";
import { segmentWord } from "./segmentation";

const base: SegmentationConfig = {
	engine: "japanese",
	splitCJK: true,
	splitEnglish: true,
	punctuationWeight: 0.2,
	punctuationMode: "merge",
	removeEmptySegments: true,
	ignoreList: new Set(),
	customRules: new Map(),
	learnedRules: new Map(),
};

const split = (word: string, config: Partial<SegmentationConfig> = {}) =>
	segmentWord(
		{ ...newLyricWord(), word, startTime: 0, endTime: 1000 },
		{ ...base, ...config },
	).map((part) => part.word);

describe("Japanese engine granularity", () => {
	it("splits by syllable when no granularity is set", () => {
		expect(split("コーヒー")).toEqual(["コー", "ヒー"]);
	});

	it("uses the chosen granularity", () => {
		expect(split("さんぽ", { japaneseGranularity: "mora" })).toEqual([
			"さ",
			"ん",
			"ぽ",
		]);
	});

	it("leaves English splitting alone", () => {
		// The prosodic dictionary splits "every" as e|very.
		expect(split("every", { engine: "prosodic" })).toEqual(["e", "very"]);
	});
});
