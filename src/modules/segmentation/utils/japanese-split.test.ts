import { describe, expect, it } from "vitest";
import { splitJapaneseSyllables as split } from "./japanese-split";

describe("Japanese split by sound", () => {
	it("keeps small kana, ー, っ and ん with the sound before", () => {
		expect(split("コーヒー")).toEqual(["コー", "ヒー"]);
		expect(split("いっしょに")).toEqual(["いっ", "しょ", "に"]);
		expect(split("さんぽ")).toEqual(["さん", "ぽ"]);
		expect(split("きょうは")).toEqual(["きょう", "は"]);
	});

	it("joins vowel pairs and long vowels, one per part", () => {
		expect(split("ファイト")).toEqual(["ファイ", "ト"]);
		expect(split("かい")).toEqual(["かい"]);
		expect(split("そう")).toEqual(["そう"]);
		expect(split("ヴァイオリン")).toEqual(["ヴァイ", "オ", "リン"]);
		expect(split("かわいい")).toEqual(["か", "わい", "い"]);
		expect(split("あおい")).toEqual(["あ", "おい"]);
		expect(split("コーイ")).toEqual(["コー", "イ"]);
	});

	it("never joins a vowel to kanji, whose reading is unknown", () => {
		expect(split("思い")).toEqual(["思", "い"]);
	});

	it("keeps punctuation, spaces and Latin text as today", () => {
		expect(split("「君」と love you!")).toEqual([
			"「",
			"君」",
			"と",
			" ",
			"love",
			" ",
			"you!",
		]);
		expect(split("   ")).toEqual(["   "]);
	});

	it("always joins back to the input", () => {
		for (const line of [
			"君の名前を呼んでいた",
			"ありがとう、さよなら",
			"チョコレート・ディスコ",
			"Oh yeah 走り出す",
		])
			expect(split(line).join("")).toBe(line);
	});
});
