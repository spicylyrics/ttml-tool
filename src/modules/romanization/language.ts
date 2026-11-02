import type { LyricLine } from "$/types/ttml";

/**
 * The language a song is romanized as. Kana and Hangul say which language a
 * line is in by themselves; Han characters alone don't (今日 is Japanese or
 * Chinese), so lines written only in Han take the song's language. That keeps
 * kanji-only lines of a Japanese song out of pinyin, and still lets a Korean
 * or Japanese line inside another song romanize as itself.
 */
export type SongLanguage = "ja" | "zh" | "yue" | "ko";
export type RomanizationLanguage = SongLanguage | "auto";

const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
const HANGUL = /\p{Script=Hangul}/u;
const HAN = /\p{Script=Han}/u;

const lineText = (line: LyricLine) =>
	line.words.map((word) => word.word).join("");

/** What a line's own script says: a language, "han" (ambiguous) or nothing. */
export function lineScript(text: string): "ja" | "ko" | "han" | undefined {
	if (KANA.test(text)) return "ja";
	if (HANGUL.test(text)) return "ko";
	if (HAN.test(text)) return "han";
	return undefined;
}

/**
 * Guesses the song's language from its lines. Any kana makes Han-only lines
 * Japanese; otherwise Hangul wins if it's the majority, and Han means Chinese.
 * Undefined when nothing in the song can be romanized.
 */
export function detectSongLanguage(
	lines: readonly LyricLine[],
): SongLanguage | undefined {
	let ja = 0;
	let ko = 0;
	let han = 0;
	for (const line of lines) {
		const script = lineScript(lineText(line));
		if (script === "ja") ja++;
		else if (script === "ko") ko++;
		else if (script === "han") han++;
	}
	if (ja > 0 && ja >= ko) return "ja";
	if (ko > 0 && ko >= han) return "ko";
	if (han > 0) return "zh";
	if (ko > 0) return "ko";
	return undefined;
}

/** The language one line romanizes as, or undefined when it has nothing to romanize. */
export function lineLanguage(
	text: string,
	songLanguage: SongLanguage,
): SongLanguage | undefined {
	const script = lineScript(text);
	if (!script) return undefined;
	if (script === "han") return songLanguage === "ko" ? "zh" : songLanguage;
	// A Chinese song's Japanese line still reads as Japanese, and the other way
	// round for Hangul.
	return script;
}
