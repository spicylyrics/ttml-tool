/**
 * Japanese auto-splitting at a chosen granularity.
 *
 * - `syllable`: one kana (or kanji) per part; small kana, ー, っ and ん join
 *   the part before them ("きょ", "コー", "いっ", "リン").
 * - `mora`: like `syllable`, but ん is its own part, as it is its own beat.
 * - `word`: word boundaries from the platform's Japanese word segmenter, with
 *   the same joining rules. Falls back to `syllable` where it's missing.
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
	SOKUON.has(char) ||
	LENGTH_MARKS.has(char) ||
	(granularity !== "mora" && MORAIC_N.has(char));

const lastChar = (token: string | undefined) =>
	token ? Array.from(token).at(-1) : undefined;

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
			if (lastIsKana && joinsPrevious(char, granularity)) {
				tokens[tokens.length - 1] += char;
			} else {
				tokens.push(char);
			}
			lastIsKana = true;
			latinRun = false;
		} else if (isPunctuation(char)) {
			const previous = lastChar(tokens.at(-1));
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
		const previous = lastChar(tokens.at(-1));
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
