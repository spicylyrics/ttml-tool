import kuromoji, { type IpadicFeatures, type Tokenizer } from "kuromoji";
import { beforeAll, describe, expect, it } from "vitest";
import { newLyricWord } from "$/types/ttml";
import { alignLineWords } from "./align-romanized";
import { romanizeJapaneseLine } from "./engines/japanese";

let tokenizer: Tokenizer<IpadicFeatures>;

beforeAll(async () => {
	tokenizer = await new Promise((resolve, reject) =>
		kuromoji
			.builder({ dicPath: "node_modules/kuromoji/dict" })
			.build((error, built) => (error ? reject(error) : resolve(built))),
	);
}, 30_000);

const align = (romaji: string, ...parts: string[]) =>
	alignLineWords(
		parts.map((word) => ({ ...newLyricWord(), word })),
		romaji,
		romanizeJapaneseLine(tokenizer, parts),
	).romanWords;

describe("pasted romaji over kanji, placed by the dictionary's readings", () => {
	it.each([
		[
			"Gokigen ukagai",
			["ご", "機", "嫌", "伺", "い"],
			["Go", "ki", "gen ", "ukaga", "i"],
		],
		[
			"Gokigenukagai",
			["ご", "機", "嫌", "伺", "い"],
			["Go", "ki", "gen", "ukaga", "i"],
		],
		["Itaitashii", ["痛", "々", "しい"], ["Ita", "ita", "shii"]],
		["Akashingou", ["赤", "信", "号"], ["Aka", "shin", "gou"]],
		["juujun", ["従", "順"], ["juu", "jun"]],
		["mohaya", ["最", "早"], ["mo", "haya"]],
		["Egao", ["笑", "顔"], ["E", "gao"]],
		["houshiki", ["方", "式"], ["hou", "shiki"]],
		["fugainai", ["不", "甲", "斐", "ない"], ["fu", "ga", "i", "nai"]],
	])("%s", (romaji, parts, expected) => {
		expect(align(romaji, ...parts)).toEqual(expected);
	});

	it("keeps the page's letters where its spelling differs", () => {
		// The dictionary reads 方式 "houshiki"; the page spells it "hoshiki".
		expect(align("hoshiki", "方", "式")).toEqual(["ho", "shiki"]);
	});
});
