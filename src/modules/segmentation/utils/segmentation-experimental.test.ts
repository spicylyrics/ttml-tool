import { describe, expect, it } from "vitest";
import { newLyricWord } from "$/types/ttml";
import type { SegmentationConfig } from "../types";
import { segmentWord } from "./segmentation";

const base: SegmentationConfig = {
	engine: "prosodic",
	splitCJK: true,
	splitEnglish: true,
	punctuationWeight: 0.2,
	punctuationMode: "merge",
	removeEmptySegments: true,
	ignoreList: new Set(),
	customRules: new Map(),
	learnedRules: new Map(),
};

const split = (word: string, config: Partial<SegmentationConfig>) =>
	segmentWord(
		{ ...newLyricWord(), word, startTime: 0, endTime: 1000 },
		{
			...base,
			...config,
		},
	).map((part) => part.word);

describe("experimental splitting options", () => {
	it("leaves the existing engines alone when unset", () => {
		expect(split("コーヒー", { engine: "japanese" })).toEqual([
			"コ",
			"ー",
			"ヒ",
			"ー",
		]);
		// The prosodic dictionary splits "every" as e|very.
		expect(split("every", {})).toEqual(["e", "very"]);
	});

	it("uses the rule-based English splitter for the prosodic engine", () => {
		expect(split("every", { englishRules: true })).toEqual(["ev", "ery"]);
		expect(split("started,", { englishRules: true })).toEqual(["start", "ed,"]);
		// Other engines ignore the option.
		expect(split("every", { englishRules: true, engine: "basic" })).toEqual([
			"every",
		]);
	});

	it("uses the chosen Japanese granularity", () => {
		expect(
			split("コーヒー", {
				engine: "japanese",
				japaneseGranularity: "syllable",
			}),
		).toEqual(["コー", "ヒー"]);
		expect(
			split("さんぽ", { engine: "japanese", japaneseGranularity: "mora" }),
		).toEqual(["さ", "ん", "ぽ"]);
	});
});
