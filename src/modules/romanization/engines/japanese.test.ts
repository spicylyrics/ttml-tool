import kuromoji, { type IpadicFeatures, type Tokenizer } from "kuromoji";
import { beforeAll, describe, expect, it } from "vitest";
import { romanizeJapaneseLine } from "./japanese";

let tokenizer: Tokenizer<IpadicFeatures>;

beforeAll(async () => {
	tokenizer = await new Promise((resolve, reject) =>
		kuromoji
			.builder({ dicPath: "node_modules/kuromoji/dict" })
			.build((error, built) => (error ? reject(error) : resolve(built))),
	);
}, 30_000);

const romanize = (...syllables: string[]) =>
	romanizeJapaneseLine(tokenizer, syllables);

describe("Japanese romanization", () => {
	it("reads kanji in context and gaps between words, Genius style", () => {
		expect(
			romanize("君", "の", "名", "前", "を", "呼", "ん", "で", "い", "た"),
		).toEqual([
			"kimi ",
			"no ",
			"na",
			"mae ",
			"wo ",
			"yo",
			"n",
			"de ",
			"i",
			"ta",
		]);
		expect(romanize("君の名前を呼んでいた")).toEqual([
			"kimi no namae wo yonde ita",
		]);
	});

	it("spells long vowels and particles the way Genius does", () => {
		expect(romanize("今", "日", "も")).toEqual(["kyo", "u ", "mo"]);
		expect(romanize("いっ", "しょ", "に", "コー", "ヒー", "を")).toEqual([
			"is",
			"sho ",
			"ni ",
			"koo",
			"hii ",
			"wo",
		]);
		expect(romanize("東", "京", "は")).toEqual(["tou", "kyou ", "wa"]);
		expect(romanize("友", "達", "さ", "ん", "へ")).toEqual([
			"tomo",
			"dachi",
			"sa",
			"n ",
			"e",
		]);
	});

	it("keeps punctuation on the word before it", () => {
		expect(romanize("Oh yeah, 走り出す")).toEqual(["Oh yeah, hashiridasu"]);
	});

	it("gives kana inside a word their own reading", () => {
		expect(romanize("Oh ", "yeah ", "走", "り", "出", "す")).toEqual([
			"Oh ",
			"yeah ",
			"hashi",
			"ri",
			"da",
			"su",
		]);
	});

	it("keeps the doubled consonant of っ with the syllable before", () => {
		expect(romanize("黙", "っ", "て")).toEqual(["dama", "t", "te"]);
		expect(romanize("言", "っ", "て", "た")).toEqual(["i", "t", "te", "ta"]);
	});

	it("keeps a copula after a noun as its own word", () => {
		expect(romanize("好", "き", "だ", "よ")).toEqual([
			"su",
			"ki ",
			"da ",
			"yo",
		]);
	});

	it("repeats the kanji before 々", () => {
		expect(romanize("燦", "々", "と")).toEqual(["san", "san ", "to"]);
	});
});
