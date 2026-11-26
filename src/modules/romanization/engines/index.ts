import cyrillicToLatin from "cyrillic-romanization";
import { transliterate as greekToLatin } from "greek-transliteration";
import { pinyin } from "pinyin-pro";
import { getJyutpingList } from "to-jyutping";
import type { SongLanguage } from "../language";
import { loadJapaneseTokenizer, romanizeJapaneseLine } from "./japanese";
import { KoreanCharReadings } from "./korean";

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
			return korean(syllables);
		case "cyrillic": {
			const ukrainian = UKRAINIAN.test(syllables.join(""));
			return bySyllable(syllables, CYRILLIC, (text) =>
				cyrillic(text, ukrainian),
			);
		}
		case "greek":
			return bySyllable(syllables, GREEK, greek);
	}
}

const HAN = /\p{Script=Han}/u;
const HANGUL = /\p{Script=Hangul}/u;
const CYRILLIC = /\p{Script=Cyrillic}/u;
const GREEK = /\p{Script=Greek}/u;
/** Letters only Ukrainian uses, which read differently there. */
const UKRAINIAN = /[ЄєІіЇїҐґ]/;

/**
 * Korean by sound, read over the whole line so a final consonant reads by the
 * block after it even across a syllable seam (같|이 → ga|chi, 먹|는 →
 * meong|neun). Each syllable gets the readings of its own characters.
 */
function korean(syllables: readonly string[]): string[] {
	const readings = KoreanCharReadings(syllables.join(""));
	let next = 0;
	return syllables.map((syllable) => {
		const own = readings.slice(next, next + syllable.length);
		next += syllable.length;
		if (!HANGUL.test(syllable)) return "";
		const romanized = own.join("").trim();
		return romanized && /\s$/.test(syllable) ? `${romanized} ` : romanized;
	});
}

/**
 * Cyrillic as romanized lyrics spell it: х is kh (the Russian table writes
 * x), щ is shch, and the hard and soft signs aren't said on their own. х is
 * swapped before converting, so a Latin x already in the text stays.
 */
function cyrillic(text: string, ukrainian: boolean): string {
	const spelled = text
		.replace(/Х(?=\p{Ll})/gu, "Kh")
		.replace(/Х/g, "KH")
		.replace(/х/g, "kh");
	return cyrillicToLatin(spelled, ukrainian ? "ukr" : "rus")
		.replace(/([Ss])hh/g, "$1hch")
		.replace(/[ʺʹ]/g, "");
}

/** Greek, with a capital written as two letters capitalized once (Θεσ → Thes). */
const greek = (text: string) =>
	greekToLatin(text).replace(
		/(TH|CH|PS)(?=\p{Ll})/gu,
		(match) => match[0] + match[1].toLowerCase(),
	);

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
