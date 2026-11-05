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
 * Whether a word has romanization worth keeping. Text still in kana, kanji,
 * Hangul, Cyrillic or Greek (left over from an import, say) isn't romanized.
 */
export const hasRomanization = (romanWord: string) =>
	!!romanWord.trim() &&
	!/[\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Han}\p{Script=Hangul}\p{Script=Cyrillic}\p{Script=Greek}]/u.test(
		romanWord,
	);

/** Letters, all of them Latin: "gimme", "God," but not "ラブ" or "Bチーム". */
export const isLatinOnly = (text: string) =>
	/\p{Script=Latin}/u.test(text) && !/(?=\p{L})\P{Script=Latin}/u.test(text);

/**
 * Applies new per-word romanization to a line, keeping or replacing what is
 * there, and rebuilds the line romanization. Undefined when nothing changes.
 */
export function mergeLineRomanization(
	line: LyricLine,
	romanWords: Record<string, string>,
	mode: ExistingMode,
	/**
	 * The line as a pasted page writes it, used when every word is new. Empty
	 * when the line needs none (all English).
	 */
	pageLine?: string,
): LineRomanization | undefined {
	let keptOld = false;
	const merged = line.words.map((word) => {
		const next = romanWords[word.id];
		// Replacing from a page clears romaji an English word got earlier.
		if (
			mode === "replace" &&
			next === "" &&
			word.romanWord &&
			isLatinOnly(word.word)
		)
			return { ...word, romanWord: "" };
		if (next === undefined || !next.trim()) {
			if (hasRomanization(word.romanWord)) keptOld = true;
			return word;
		}
		if (mode === "fillEmpty" && hasRomanization(word.romanWord)) {
			keptOld = true;
			return word;
		}
		return { ...word, romanWord: next };
	});
	const romanLyric =
		pageLine !== undefined && !keptOld
			? pageLine
			: lineRomanizationFromWords(merged);
	const clearsLine =
		mode === "replace" && pageLine === "" && !keptOld && !!line.romanLyric;
	if (merged.every((word, index) => word === line.words[index]) && !clearsLine)
		return;
	return {
		lineId: line.id,
		romanWords: Object.fromEntries(
			merged.map((word) => [word.id, word.romanWord]),
		),
		romanLyric,
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
		// Words already in Latin letters ("Oh yeah") count as their own
		// romanization, so the romanized line reads in full in Spicy Lyrics.
		const romanized = capitalizeLine(
			(await romanizeSyllables(syllables, language)).map(
				(text, index) =>
					text ||
					(/\p{Script=Latin}/u.test(syllables[index]) ? syllables[index] : ""),
			),
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
	line.words.some((word) => hasRomanization(word.romanWord));
