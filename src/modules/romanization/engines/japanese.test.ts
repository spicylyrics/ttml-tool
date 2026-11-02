import kuromoji, { type IpadicFeatures, type Tokenizer } from "kuromoji";
import { beforeAll, describe, expect, it } from "vitest";
import { japaneseWordStarts, romanizeJapaneseLine } from "./japanese";

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

	it("gives a ー split into its own syllable the vowel it holds", () => {
		expect(romanize("セ", "ー", "、")).toEqual(["se", "e", ","]);
		expect(romanize("マ", "ー", "ナ")).toEqual(["ma", "a", "na"]);
	});

	it("leans an opening quote on the word after it", () => {
		expect(romanize("「", "今", "ま")).toEqual(['"', "ima ", "ma"]);
		expect(romanize("「今", "ま")).toEqual(['"ima ', "ma"]);
	});

	it("reads half-width katakana", () => {
		expect(
			romanize(
				"「おい、",
				"なん",
				"で",
				"ｿﾝ",
				"ﾅ",
				"こ",
				"と",
				"や",
				"って",
				"んの？」",
			),
		).toEqual([
			'"oi, ',
			"nan",
			"de ",
			"son",
			"na ",
			"ko",
			"to ",
			"ya",
			"tte",
			'n no?"',
		]);
	});

	it("reads katakana words in any context", () => {
		expect(romanize("で", "ソンナ", "こ")).toEqual(["de ", "sonna ", "ko"]);
		expect(romanize("でソンナこと")).toEqual(["de sonna koto"]);
	});

	it("finds where words start, particles apart", () => {
		const words = (text: string) => {
			const starts = [...japaneseWordStarts(tokenizer, text)];
			return [0, ...starts].map((start, index) =>
				text.slice(start, starts[index] ?? text.length),
			);
		};
		expect(words("君の名前を呼んでいた")).toEqual([
			"君",
			"の",
			"名前",
			"を",
			"呼んで",
			"いた",
		]);
		expect(words("「おい、なんでｿﾝﾅことを")).toEqual([
			"「おい、",
			"なんで",
			"ｿﾝﾅ",
			"こと",
			"を",
		]);
	});

	it("keeps casual ん and a stretched vowel on the word before", () => {
		expect(romanize("抜かしてんだか")).toEqual(["nukashiten da ka"]);
		expect(romanize("うるせえな")).toEqual(["urusee na"]);
		expect(romanize("やってんの")).toEqual(["yatten no"]);
		// Not every vowel after a word stretches it.
		expect(romanize("呼んでいた")).toEqual(["yonde ita"]);
	});

	it("reads a word-initial っ part with the sound after it", () => {
		// Process lyrics' words 悪い|って|言わ, split by sound.
		expect(romanize("悪", "い", "って", "言", "わ")).toEqual([
			"waru",
			"i ",
			"tte ",
			"i",
			"wa",
		]);
	});

	it("repeats the kanji before 々", () => {
		expect(romanize("燦", "々", "と")).toEqual(["san", "san ", "to"]);
	});
});
