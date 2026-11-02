import type { LyricLine } from "$/types/ttml";

/**
 * The language a song is romanized as: the ones Spicy Lyrics romanizes, plus
 * Cantonese. Kana, Hangul, Cyrillic and Greek say which language a line is
 * in by themselves; Han characters alone don't (今日 is Japanese or Chinese),
 * so lines written only in Han take the song's language. That keeps
 * kanji-only lines of a Japanese song out of pinyin, and still lets a line in
 * another script romanize as itself.
 */
export type SongLanguage = "ja" | "zh" | "yue" | "ko" | "cyrillic" | "greek";
export type RomanizationLanguage = SongLanguage | "auto";

type Script = Exclude<SongLanguage, "zh" | "yue"> | "han";

const SCRIPTS: Array<[Script, RegExp]> = [
	["ja", /[\p{Script=Hiragana}\p{Script=Katakana}]/u],
	["ko", /\p{Script=Hangul}/u],
	["han", /\p{Script=Han}/u],
	["cyrillic", /\p{Script=Cyrillic}/u],
	["greek", /\p{Script=Greek}/u],
];

const lineText = (line: LyricLine) =>
	line.words.map((word) => word.word).join("");

/** What a line's own script says: a language, "han" (ambiguous) or nothing. */
export function lineScript(text: string): Script | undefined {
	return SCRIPTS.find(([, pattern]) => pattern.test(text))?.[0];
}

/**
 * Guesses the song's language from its lines: the script on the most lines,
 * where any kana makes Han-only lines Japanese and Han alone means Chinese.
 * Undefined when nothing in the song can be romanized.
 */
export function detectSongLanguage(
	lines: readonly LyricLine[],
): SongLanguage | undefined {
	const counts = new Map<Script, number>();
	for (const line of lines) {
		const script = lineScript(lineText(line));
		if (script) counts.set(script, (counts.get(script) ?? 0) + 1);
	}
	if (counts.has("ja")) {
		const ja = counts.get("ja") ?? 0;
		counts.set("ja", ja + (counts.get("han") ?? 0));
		counts.delete("han");
	}
	let best: Script | undefined;
	for (const [script, count] of counts)
		if (!best || count > (counts.get(best) ?? 0)) best = script;
	return best === "han" ? "zh" : best;
}

/** The language one line romanizes as, or undefined when it has nothing to romanize. */
export function lineLanguage(
	text: string,
	songLanguage: SongLanguage,
): SongLanguage | undefined {
	const script = lineScript(text);
	if (!script) return undefined;
	if (script !== "han") return script;
	return songLanguage === "ja" || songLanguage === "yue" ? songLanguage : "zh";
}
