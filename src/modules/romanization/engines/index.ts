import cyrillicToLatin from "cyrillic-romanization";
import { transliterate as greekToLatin } from "greek-transliteration";
import { Romanize as Hangul } from "hangul-romanize";
import { pinyin } from "pinyin-pro";
import { getJyutpingList } from "to-jyutping";
import type { SongLanguage } from "../language";
import { loadJapaneseTokenizer, romanizeJapaneseLine } from "./japanese";

/**
 * Romanization on the device, nothing sent anywhere, covering the languages
 * Spicy Lyrics romanizes plus Cantonese. Takes one line's syllables and
 * returns one romanization per syllable; a trailing space marks a word gap.
 */
export async function romanizeSyllables(
	syllables: readonly string[],
	language: SongLanguage,
): Promise<string[]> {
	switch (language) {
		case "ja":
			return romanizeJapaneseLine(await loadJapaneseTokenizer(), syllables);
		case "zh":
			return byHan(syllables, (text) =>
				pinyin(text, { toneType: "symbol", type: "array" }),
			);
		case "yue":
			return byHan(syllables, (text) =>
				getJyutpingList(text).map(([char, reading]) => reading ?? char),
			);
		case "ko":
			return bySyllable(syllables, HANGUL, (text) => Hangul.from(text));
		case "cyrillic":
			return bySyllable(syllables, CYRILLIC, (text) =>
				cyrillicToLatin(
					text,
					UKRAINIAN.test(syllables.join("")) ? "ukr" : "rus",
				),
			);
		case "greek":
			return bySyllable(syllables, GREEK, (text) => greekToLatin(text));
	}
}

const HAN = /\p{Script=Han}/u;
const HANGUL = /\p{Script=Hangul}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const GREEK = /\p{Script=Greek}/u;
/** Letters only Ukrainian uses, which read differently there. */
const UKRAINIAN = /[ЄєІіЇїҐґ]/;

/**
 * Scripts written with spaces: each syllable romanizes on its own, and a
 * space after it in the lyrics is a gap after it here too.
 */
function bySyllable(
	syllables: readonly string[],
	script: RegExp,
	romanize: (text: string) => string,
): string[] {
	return syllables.map((syllable) => {
		if (!script.test(syllable)) return "";
		const romanized = romanize(syllable.trim()).trim();
		return romanized && /\s$/.test(syllable) ? `${romanized} ` : romanized;
	});
}

/**
 * Chinese reads per character with the whole line as context (for
 * characters with several readings), and every Han syllable after the first
 * starts a word, so readings come out spaced like the line under the lyrics.
 */
function byHan(
	syllables: readonly string[],
	readLine: (text: string) => string[],
): string[] {
	const han = syllables.flatMap((syllable) =>
		Array.from(syllable).filter((char) => HAN.test(char)),
	);
	const readings = han.length > 0 ? readLine(han.join("")) : [];
	let next = 0;
	const romanized = syllables.map((syllable) =>
		Array.from(syllable)
			.filter((char) => HAN.test(char))
			.map(() => readings[next++] ?? "")
			.filter(Boolean)
			.join(" "),
	);
	return romanized.map((text, index) => {
		if (!text) return "";
		const laterHan = romanized.slice(index + 1).some(Boolean);
		return laterHan || /\s$/.test(syllables[index]) ? `${text} ` : text;
	});
}
