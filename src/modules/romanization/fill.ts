import type { LyricLine, LyricWord } from "$/types/ttml";
import { getPhonetic, getPhoneticSyllables } from "$/utils/phonetic";
import { normalizeRomaji } from "./align-romanized";
import { lineLanguage, type SongLanguage } from "./language";

/** What to do with words that already have romanization. */
export type ExistingMode = "fillEmpty" | "replace";

export interface LineRomanization {
	lineId: string;
	romanWords: Record<string, string>;
	romanLyric: string;
}

/**
 * The line's romanization, built from its words so the two never drift
 * apart: romanized words as written, the rest (English, punctuation) as is.
 */
export const lineRomanizationFromWords = (
	words: readonly Pick<LyricWord, "word" | "romanWord">[],
) =>
	words
		.map((word) => (word.romanWord.trim() ? word.romanWord : word.word))
		.join("")
		.replace(/\s+/g, " ")
		.trim();

/** A space after the word in the lyrics is a word gap in its romanization too. */
const withGap = (romanization: string, word: string) =>
	romanization && /\s$/u.test(word)
		? `${romanization.trimEnd()} `
		: romanization;

/**
 * Applies new per-word romanization to a line, keeping or replacing what is
 * there, and rebuilds the line romanization. Undefined when nothing changes.
 */
export function mergeLineRomanization(
	line: LyricLine,
	romanWords: Record<string, string>,
	mode: ExistingMode,
): LineRomanization | undefined {
	const merged = line.words.map((word) => {
		const next = romanWords[word.id];
		if (next === undefined || !next.trim()) return word;
		if (mode === "fillEmpty" && word.romanWord.trim()) return word;
		return { ...word, romanWord: next };
	});
	if (merged.every((word, index) => word === line.words[index])) return;
	return {
		lineId: line.id,
		romanWords: Object.fromEntries(
			merged.map((word) => [word.id, word.romanWord]),
		),
		romanLyric: lineRomanizationFromWords(merged),
	};
}

/**
 * Which syllables end a word, read off the spaced whole-line romaji
 * ("kimi no namae wo"), Genius style. Japanese has no spaces to take gaps
 * from, so they come from the reading. All false when the syllables don't
 * add up to the same letters as the line, since the cuts would be guesses.
 */
export function wordEnds(
	syllables: readonly string[],
	words: readonly string[],
	spacedLine: string,
): boolean[] {
	const none = syllables.map(() => false);
	const boundaries = new Set<number>();
	let total = 0;
	for (const part of spacedLine.split(/\s+/)) {
		total += normalizeRomaji(part).length;
		boundaries.add(total);
	}
	// English words in the line count with their own letters.
	const lengths = syllables.map(
		(syllable, index) => normalizeRomaji(syllable || words[index] || "").length,
	);
	if (lengths.reduce((sum, length) => sum + length, 0) !== total) return none;
	let position = 0;
	return lengths.map((length, index) => {
		position += length;
		const last = lengths.slice(index + 1).every((rest) => rest === 0);
		return (
			!!syllables[index] && length > 0 && !last && boundaries.has(position)
		);
	});
}

/** Romanizes lines automatically; lines with nothing to romanize are skipped. */
export async function romanizeLines(
	lines: readonly LyricLine[],
	songLanguage: SongLanguage,
	mode: ExistingMode,
): Promise<LineRomanization[]> {
	const results = await Promise.all(
		lines.map(async (line) => {
			const capsules = line.words.map((word) => word.word);
			const language = lineLanguage(capsules.join(""), songLanguage);
			if (!language) return;
			const syllables = await getPhoneticSyllables(capsules, language);
			const ends =
				language === "ja" && capsules.length > 1
					? wordEnds(
							syllables,
							capsules,
							await getPhonetic(
								capsules.join("").replace(/\s+/g, ""),
								language,
								true,
							),
						)
					: syllables.map(() => false);
			const romanWords = Object.fromEntries(
				line.words.map((word, index) => {
					const syllable = syllables[index] ?? "";
					return [
						word.id,
						ends[index]
							? `${syllable.trimEnd()} `
							: withGap(syllable, word.word),
					];
				}),
			);
			return mergeLineRomanization(line, romanWords, mode);
		}),
	);
	return results.filter((result) => result !== undefined);
}

/** Lines in the song that have something to romanize. */
export const romanizableLines = (
	lines: readonly LyricLine[],
	songLanguage: SongLanguage,
) =>
	lines.filter((line) =>
		lineLanguage(line.words.map((word) => word.word).join(""), songLanguage),
	);

/** Whether a line has any romanization yet. */
export const isLineRomanized = (line: LyricLine) =>
	line.words.some((word) => word.romanWord.trim()) || !!line.romanLyric?.trim();
