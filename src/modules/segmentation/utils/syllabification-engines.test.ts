import { describe, expect, it } from "vitest";
import { newLyricWord } from "$/types/ttml";
import type { SegmentationConfig } from "../types";
import { loadHyphenator } from "./hyphen-loader";
import { segmentWord } from "./segmentation";
import {
	getSyllabificationEngine,
	splitJapaneseText,
} from "./syllabification-engines";

const prosodicConfig: SegmentationConfig = {
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

describe("syllabification engines", () => {
	it("uses Prosodic dictionary entries before its speech fallback", () => {
		const parts = getSyllabificationEngine("prosodic").split("everything");
		expect(parts.join("")).toBe("everything");
		expect(parts.length).toBeGreaterThan(1);
	});

	it("handles dropped-g lyric spellings", () => {
		const parts = getSyllabificationEngine("prosodic").split("singin");
		expect(parts.join("")).toBe("singin");
		expect(parts.length).toBeGreaterThan(1);
	});

	it.each([
		// dropped g, with and without an apostrophe
		["goin'", "go/in'"],
		["singin’", "sing/in’"],
		["rockin'", "ro/ckin'"],
		["fightin'", "figh/tin'"],
		["begin", "be/gin"],
		// n't is a syllable only after a consonant
		["didn't", "did/n't"],
		["couldn't", "could/n't"],
		["isn't", "is/n't"],
		["don't", "don't"],
		["can't", "can't"],
		["weren't", "weren't"],
		// compounds split at the seam
		["upstate", "up/state"],
		["mainstream", "main/stream"],
		["backseat", "back/seat"],
		["weekend", "week/end"],
		["without", "with/out"],
		["somebody", "some/bo/dy"],
		["however", "how/e/ver"],
		["father", "fa/ther"],
		["legend", "le/gend"],
		// un- keeps its own syllable
		["unstoppable", "un/stop/pa/ble"],
		["until", "un/til"],
		// letter-by-letter acronyms, but not interjections
		["DJ", "D/J"],
		["HMM", "HMM"],
		["LOVE", "LOVE"],
		// accented vowels count as vowels
		["cliché", "cli/ché"],
		["déjà", "dé/jà"],
	])("splits %s as %s", (word, expected) => {
		expect(getSyllabificationEngine("prosodic").split(word).join("/")).toBe(
			expected,
		);
	});

	it("keeps contractions with typographic apostrophes together", () => {
		for (const contraction of ["we’re", "you’ve", "they’re"]) {
			const word = { ...newLyricWord(), word: contraction };
			expect(
				segmentWord(word, prosodicConfig).map((part) => part.word),
			).toEqual([contraction]);
		}
	});

	it("keeps basic and none engines unsplit", () => {
		expect(getSyllabificationEngine("basic").split("beautiful")).toEqual([
			"beautiful",
		]);
		expect(getSyllabificationEngine("none").split("beautiful")).toEqual([
			"beautiful",
		]);
	});

	it("keeps Japanese modifiers and punctuation with their mora", () => {
		expect(splitJapaneseText("キャット。")).toEqual(["キャ", "ッ", "ト。"]);
	});

	it.each([
		["silabas", "corazón"],
		["syllabify-fr", "bonjour"],
		["syllabify", "привет"],
	] as const)("preserves text with the %s engine", (engine, word) => {
		const parts = getSyllabificationEngine(engine).split(word);
		expect(parts.join("")).toBe(word);
	});

	it("loads Polish hyphenation patterns", async () => {
		const hyphenate = await loadHyphenator("pl");
		expect(hyphenate?.("przepraszam").split("\u00ad")).toEqual([
			"prze",
			"pra",
			"szam",
		]);
	});
});
