import { toRomaji } from "wanakana";
import { PUNCT_LEFT } from "./charUtils";

/**
 * Japanese split by sound, one part per syllable as it's heard: small kana,
 * ー, っ and ん join the part before them ("きょ", "コー", "いっ", "リン"),
 * and so does a vowel that makes a long sound or a pair with the kana before
 * it ("かい", "そう"). Kanji stay one per part, since their reading is
 * unknown here. Splitting into words is Process lyrics' job.
 */

// Each with its half-width katakana form (ｧ, ｯ, ﾝ, ｰ, ﾞ) too.
const SMALL_KANA = new Set(
	Array.from(
		"ぁぃぅぇぉゃゅょゎゕゖァィゥェォャュョヮヵヶㇰㇱㇲㇳㇴㇵㇶㇷㇸㇹㇺㇻㇼㇽㇾㇿｧｨｩｪｫｬｭｮ",
	),
);
const SOKUON = new Set(["っ", "ッ", "ｯ"]);
const MORAIC_N = new Set(["ん", "ン", "ﾝ"]);
const LENGTH_MARKS = new Set(["ー", "〜", "～", "゛", "゜", "ｰ", "ﾞ", "ﾟ"]);

const isJapaneseCharacter = (char: string) =>
	/[々〆ーｰﾞﾟ\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/u.test(char);
const isPunctuation = (char: string) =>
	!LENGTH_MARKS.has(char) && /[\p{P}\p{S}]/u.test(char);
const isSpace = (char: string) => /^\s$/u.test(char);

const joinsPrevious = (char: string) =>
	SMALL_KANA.has(char) ||
	SOKUON.has(char) ||
	LENGTH_MARKS.has(char) ||
	MORAIC_N.has(char);

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
	ｱ: "a",
	ｲ: "i",
	ｳ: "u",
	ｴ: "e",
	ｵ: "o",
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

/** Whether a text is Japanese to split: any kana in it. */
export const hasKana = (text: string) =>
	/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(text);

export function splitJapaneseSyllables(text: string): string[] {
	if (!text.trim()) return [text];
	const tokens: string[] = [];
	// Whether the last token may take a following small kana, ー or っ.
	let lastIsKana = false;
	let latinRun = false;
	// A っ with nothing before it to join (a word like って from Process
	// lyrics) joins the sound after it instead: って is one part, "tte".
	let sokuonWaits = false;
	// The last token is an opening quote waiting for the sound after it.
	let opening = false;
	for (const char of Array.from(text)) {
		if (isSpace(char)) {
			tokens.push(char);
			lastIsKana = false;
			latinRun = false;
			sokuonWaits = false;
			opening = false;
		} else if (opening) {
			// An opening quote or bracket goes with the sound after it.
			tokens[tokens.length - 1] += char;
			opening = isPunctuation(char);
			lastIsKana = !opening && isJapaneseCharacter(char);
			latinRun = !opening && !lastIsKana;
			sokuonWaits = SOKUON.has(char);
		} else if (isJapaneseCharacter(char)) {
			const previous = tokens[tokens.length - 1] ?? "";
			if (
				sokuonWaits ||
				(lastIsKana && (joinsPrevious(char) || joinsAsVowel(previous, char)))
			) {
				tokens[tokens.length - 1] += char;
				sokuonWaits = sokuonWaits && SOKUON.has(char);
			} else {
				tokens.push(char);
				sokuonWaits = SOKUON.has(char);
			}
			lastIsKana = true;
			latinRun = false;
		} else if (isPunctuation(char)) {
			const previous = lastChar(tokens[tokens.length - 1]);
			if (PUNCT_LEFT.has(char)) {
				tokens.push(char);
				opening = true;
			} else if (previous && !isSpace(previous))
				tokens[tokens.length - 1] += char;
			else tokens.push(char);
			lastIsKana = false;
			latinRun = false;
			sokuonWaits = false;
		} else {
			if (latinRun) tokens[tokens.length - 1] += char;
			else tokens.push(char);
			lastIsKana = false;
			latinRun = true;
			sokuonWaits = false;
		}
	}
	return tokens;
}
