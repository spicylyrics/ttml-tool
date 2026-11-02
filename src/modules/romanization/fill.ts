import type { LyricLine, LyricWord } from "$/types/ttml";
import { romanizeSyllables } from "./engines";
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
 * Genius style: the line's first letter is a capital, when the line starts
 * with a romanized word (not "Oh yeah ...").
 */
export function capitalizeLine(
	romanized: readonly string[],
	syllables: readonly string[],
): string[] {
	const first = syllables.findIndex((text) => /\p{L}/u.test(text));
	return romanized.map((text, index) =>
		index === first
			? text.replace(/\p{L}/u, (char) => char.toUpperCase())
			: text,
	);
}

/**
 * Romanizes lines on the device; lines with nothing to romanize are skipped.
 * Each line reads as a whole, so words split into syllables keep their
 * reading and the gaps between words.
 */
export async function romanizeLines(
	lines: readonly LyricLine[],
	songLanguage: SongLanguage,
	mode: ExistingMode,
): Promise<LineRomanization[]> {
	const results: LineRomanization[] = [];
	for (const line of lines) {
		const syllables = line.words.map((word) => word.word);
		const language = lineLanguage(syllables.join(""), songLanguage);
		if (!language) continue;
		const romanized = capitalizeLine(
			await romanizeSyllables(syllables, language),
			syllables,
		);
		const update = mergeLineRomanization(
			line,
			Object.fromEntries(
				line.words.map((word, index) => [word.id, romanized[index] ?? ""]),
			),
			mode,
		);
		if (update) results.push(update);
	}
	return results;
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
