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

const split = (word: string, config: Partial<SegmentationConfig> = {}) =>
	segmentWord(
		{ ...newLyricWord(), word, startTime: 0, endTime: 1000 },
		{ ...base, ...config },
	).map((part) => part.word);

describe("Japanese splitting by script", () => {
	it("splits Japanese by sound whatever engine is picked", () => {
		expect(split("コーヒー")).toEqual(["コー", "ヒー"]);
		expect(split("いっしょに", { engine: "basic" })).toEqual([
			"いっ",
			"しょ",
			"に",
		]);
	});

	it("splits half-width katakana too", () => {
		expect(split("ｿﾝﾅ")).toEqual(["ｿﾝ", "ﾅ"]);
		expect(split("ｶﾞｯｺｰ")).toEqual(["ｶﾞｯ", "ｺｰ"]);
	});

	it("leaves English splitting alone", () => {
		// The prosodic dictionary splits "every" as e|very.
		expect(split("every")).toEqual(["e", "very"]);
	});

	it("does nothing with the none engine", () => {
		expect(split("コーヒー", { engine: "none" })).toEqual(["コーヒー"]);
	});
});
