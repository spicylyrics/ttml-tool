import { describe, expect, it } from "vitest";
import { splitJapaneseByGranularity } from "./japanese-split";

const split = splitJapaneseByGranularity;

describe("Japanese granularity splitting", () => {
	it("keeps small kana and long-vowel marks with their mora", () => {
		expect(split("コーヒー", "syllable")).toEqual(["コー", "ヒー"]);
		expect(split("ファイト", "syllable")).toEqual(["ファ", "イ", "ト"]);
		expect(split("きょうは", "syllable")).toEqual(["きょ", "う", "は"]);
		expect(split("ヴァイオリン", "syllable")).toEqual([
			"ヴァ",
			"イ",
			"オ",
			"リン",
		]);
		expect(split("いっしょに", "syllable")).toEqual(["いっ", "しょ", "に"]);
	});

	it("gives ん its own beat at mora granularity", () => {
		expect(split("ヴァイオリン", "mora")).toEqual([
			"ヴァ",
			"イ",
			"オ",
			"リ",
			"ン",
		]);
		expect(split("さんぽ", "mora")).toEqual(["さ", "ん", "ぽ"]);
		expect(split("いっしょに", "mora")).toEqual(["いっ", "しょ", "に"]);
	});

	it("keeps punctuation, spaces and Latin text as today", () => {
		expect(split("「君」と love you!", "syllable")).toEqual([
			"「",
			"君」",
			"と",
			" ",
			"love",
			" ",
			"you!",
		]);
		expect(split("   ", "mora")).toEqual(["   "]);
	});

	it("splits on word boundaries and keeps っ/ん with the word before", () => {
		const words = split("僕らはきっと待ってる", "word");
		expect(words.join("")).toBe("僕らはきっと待ってる");
		expect(words).toContain("きっと");
		expect(words.some((word) => word.startsWith("っ"))).toBe(false);
		expect(split("夜に駆ける。", "word")).toEqual(["夜", "に", "駆ける。"]);
	});

	it("always joins back to the input", () => {
		const lines = [
			"君の名前を呼んでいた",
			"ありがとう、さよなら",
			"チョコレート・ディスコ",
			"Oh yeah 走り出す",
		];
		for (const line of lines) {
			for (const granularity of ["syllable", "mora", "word"] as const) {
				expect(split(line, granularity).join("")).toBe(line);
			}
		}
	});
});
