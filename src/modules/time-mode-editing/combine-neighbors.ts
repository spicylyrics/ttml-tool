import { combineSelectedWords } from "$/modules/lyric-editor/utils/combine-words";
import type { LyricWord } from "$/types/ttml";

export type CombineDirection = "previous" | "next";

const isBlank = (word: LyricWord) => word.word.trim() === "";

/**
 * Index range from the word to its nearest non-blank neighbor in `direction`,
 * so blank words between them are merged too. Null when there is no neighbor.
 */
export function getNeighborRange(
	words: readonly LyricWord[],
	wordIndex: number,
	direction: CombineDirection,
): [number, number] | null {
	if (!words[wordIndex]) return null;
	const step = direction === "next" ? 1 : -1;
	for (let i = wordIndex + step; i >= 0 && i < words.length; i += step) {
		if (isBlank(words[i])) continue;
		return direction === "next" ? [wordIndex, i] : [i, wordIndex];
	}
	return null;
}

/**
 * Combines a word with its neighbor through the Edit-mode combine utility:
 * the result takes the first start time and the last end time.
 */
export function combineWithNeighbor(
	words: LyricWord[],
	wordIndex: number,
	direction: CombineDirection,
): { words: LyricWord[]; combined: LyricWord } | null {
	const range = getNeighborRange(words, wordIndex, direction);
	if (!range) return null;
	const ids = new Set(words.slice(range[0], range[1] + 1).map((w) => w.id));
	const result = combineSelectedWords(words, ids);
	return { words: result, combined: result[range[0]] };
}
