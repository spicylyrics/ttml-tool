import { describe, expect, it } from "vitest";
import { splitJapaneseByGranularity } from "./japanese-split";

const split = splitJapaneseByGranularity;

describe("Japanese granularity splitting", () => {
	it("splits by sound at syllable granularity", () => {
		expect(split("コーヒー", "syllable")).toEqual(["コー", "ヒー"]);
		expect(split("いっしょに", "syllable")).toEqual(["いっ", "しょ", "に"]);
		expect(split("さんぽ", "syllable")).toEqual(["さん", "ぽ"]);
		expect(split("きょうは", "syllable")).toEqual(["きょう", "は"]);
	});

	it("joins vowel pairs and long vowels, one per part", () => {
		expect(split("ファイト", "syllable")).toEqual(["ファイ", "ト"]);
		expect(split("かい", "syllable")).toEqual(["かい"]);
		expect(split("そう", "syllable")).toEqual(["そう"]);
		expect(split("ヴァイオリン", "syllable")).toEqual(["ヴァイ", "オ", "リン"]);
		expect(split("かわいい", "syllable")).toEqual(["か", "わい", "い"]);
		expect(split("あおい", "syllable")).toEqual(["あ", "おい"]);
		expect(split("コーイ", "syllable")).toEqual(["コー", "イ"]);
	});

	it("never joins a vowel to kanji, whose reading is unknown", () => {
		expect(split("思い", "syllable")).toEqual(["思", "い"]);
	});

	it("gives every beat its own part at mora granularity", () => {
		expect(split("コーヒー", "mora")).toEqual(["コ", "ー", "ヒ", "ー"]);
		expect(split("ヴァイオリン", "mora")).toEqual([
			"ヴァ",
			"イ",
			"オ",
			"リ",
			"ン",
		]);
		expect(split("さんぽ", "mora")).toEqual(["さ", "ん", "ぽ"]);
		expect(split("いっしょに", "mora")).toEqual(["い", "っ", "しょ", "に"]);
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
