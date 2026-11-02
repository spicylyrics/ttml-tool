import { toRomaji } from "wanakana";

/**
 * Japanese auto-splitting at a chosen granularity.
 *
 * - `syllable`: one part per sound as it's heard. Small kana, ー, っ and ん
 *   join the part before them ("きょ", "コー", "いっ", "リン"), and so does a
 *   vowel that makes a long sound or a pair with the kana before it ("かい",
 *   "そう"). Kanji stay one per part, since their reading is unknown.
 * - `mora`: one part per beat: only small kana join ("きょ", "ファ").
 * - `word`: word boundaries from the platform's Japanese word segmenter, with
 *   the syllable joining rules for っ, ん, ー and small kana. Falls back to
 *   `syllable` where it's missing.
 */
export type JapaneseGranularity = "syllable" | "mora" | "word";

export const JAPANESE_GRANULARITIES: readonly JapaneseGranularity[] = [
	"syllable",
	"mora",
	"word",
];

const SMALL_KANA = new Set(
	Array.from(
		"ぁぃぅぇぉゃゅょゎゕゖァィゥェォャュョヮヵヶㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿ",
	),
);
const SOKUON = new Set(["っ", "ッ"]);
const MORAIC_N = new Set(["ん", "ン"]);
const LENGTH_MARKS = new Set(["ー", "〜", "～", "゛", "゜"]);

const isJapaneseCharacter = (char: string) =>
	/[々〆ー\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char);
const isPunctuation = (char: string) =>
	!LENGTH_MARKS.has(char) && /[\p{P}\p{S}]/u.test(char);
const isSpace = (char: string) => /^\s$/u.test(char);

const joinsPrevious = (char: string, granularity: JapaneseGranularity) =>
	SMALL_KANA.has(char) ||
	(granularity !== "mora" &&
		(SOKUON.has(char) || LENGTH_MARKS.has(char) || MORAIC_N.has(char)));

const VOWEL_KANA: Record<string, string> = {
	あ: "a",
	い: "i",
	う: "u",
	え: "e",
	お: "o",
	ア: "a",
	イ: "i",
	ウ: "u",
	エ: "e",
	オ: "o",
};
/** Vowel pairs heard as one sound: diphthongs and long vowels. */
const VOWEL_PAIRS = new Set([
	"ai",
	"oi",
	"ui",
	"ei",
	"aa",
	"ii",
	"uu",
	"ee",
	"oo",
	"ou",
]);
const isKana = (char: string) =>
	/[\p{Script=Hiragana}\p{Script=Katakana}ー]/u.test(char);

/** Whether a vowel kana joins the kana part before it ("か" + "い" → "かい"). */
const joinsAsVowel = (part: string, char: string) => {
	const vowel = VOWEL_KANA[char];
	if (!vowel) return false;
	const chars = Array.from(part);
	const last = chars[chars.length - 1] ?? "";
	if (!chars.every(isKana) || SOKUON.has(last)) return false;
	// One sound per part: a part that already holds a long sound or a vowel
	// pair ("コー", "かい") stays as is.
	if (LENGTH_MARKS.has(last) || (chars.length > 1 && VOWEL_KANA[last]))
		return false;
	const previous = toRomaji(part).slice(-1);
	return VOWEL_PAIRS.has(previous + vowel);
};

const lastChar = (token: string | undefined) =>
	token ? Array.from(token).pop() : undefined;

function splitByCharacter(
	text: string,
	granularity: JapaneseGranularity,
): string[] {
	const tokens: string[] = [];
	// Whether the last token may take a following small kana, ー or っ.
	let lastIsKana = false;
	let latinRun = false;
	for (const char of Array.from(text)) {
		if (isSpace(char)) {
			tokens.push(char);
			lastIsKana = false;
			latinRun = false;
		} else if (isJapaneseCharacter(char)) {
			const previous = tokens[tokens.length - 1] ?? "";
			if (
				lastIsKana &&
				(joinsPrevious(char, granularity) ||
					(granularity === "syllable" && joinsAsVowel(previous, char)))
			) {
				tokens[tokens.length - 1] += char;
			} else {
				tokens.push(char);
			}
			lastIsKana = true;
			latinRun = false;
		} else if (isPunctuation(char)) {
			const previous = lastChar(tokens[tokens.length - 1]);
			if (previous && !isSpace(previous)) tokens[tokens.length - 1] += char;
			else tokens.push(char);
			lastIsKana = false;
			latinRun = false;
		} else {
			if (latinRun) tokens[tokens.length - 1] += char;
			else tokens.push(char);
			lastIsKana = false;
			latinRun = true;
		}
	}
	return tokens;
}

type WordSegmenter = {
	segment: (text: string) => Iterable<{ segment: string }>;
};

const createWordSegmenter = (): WordSegmenter | undefined => {
	const Segmenter = (
		Intl as { Segmenter?: new (...args: unknown[]) => WordSegmenter }
	).Segmenter;
	if (typeof Segmenter !== "function") return undefined;
	try {
		return new Segmenter("ja", { granularity: "word" });
	} catch {
		return undefined;
	}
};

let wordSegmenter: WordSegmenter | null | undefined;

function splitByWord(text: string): string[] {
	if (wordSegmenter === undefined)
		wordSegmenter = createWordSegmenter() ?? null;
	if (!wordSegmenter) return splitByCharacter(text, "syllable");

	const tokens: string[] = [];
	for (const { segment } of wordSegmenter.segment(text)) {
		const first = Array.from(segment)[0] ?? "";
		const previous = lastChar(tokens[tokens.length - 1]);
		const previousIsText = !!previous && !isSpace(previous);
		if (
			previousIsText &&
			(Array.from(segment).every(isPunctuation) ||
				(isJapaneseCharacter(previous) && joinsPrevious(first, "word")))
		) {
			tokens[tokens.length - 1] += segment;
		} else {
			tokens.push(segment);
		}
	}
	return tokens;
}

export function splitJapaneseByGranularity(
	text: string,
	granularity: JapaneseGranularity,
): string[] {
	if (!text.trim()) return [text];
	return granularity === "word"
		? splitByWord(text)
		: splitByCharacter(text, granularity);
}
