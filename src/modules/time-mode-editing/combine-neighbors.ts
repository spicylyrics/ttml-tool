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

const isUntimed = (word: LyricWord) =>
	word.startTime === 0 && word.endTime === 0;

/**
 * The time range a combined word keeps: from the earliest start to the latest
 * end of the words that have timing, so an untimed (0, 0) neighbor doesn't
 * leave the result ending at 0. Null when none of them is timed.
 */
export function combinedTimeRange(
	words: readonly LyricWord[],
): { startTime: number; endTime: number } | null {
	const timed = words.filter((word) => !isUntimed(word));
	if (timed.length === 0) return null;
	const startTime = Math.min(...timed.map((word) => word.startTime));
	const endTime = Math.max(...timed.map((word) => word.endTime));
	// A word timed mid-sync can still have no end; never end before the start.
	return { startTime, endTime: Math.max(startTime, endTime) };
}

/**
 * Combines a word with its neighbor through the Edit-mode combine utility,
 * then gives the result the range of the timed words it was made from.
 */
export function combineWithNeighbor(
	words: LyricWord[],
	wordIndex: number,
	direction: CombineDirection,
): { words: LyricWord[]; combined: LyricWord } | null {
	const range = getNeighborRange(words, wordIndex, direction);
	if (!range) return null;
	const merged = words.slice(range[0], range[1] + 1);
	const ids = new Set(merged.map((w) => w.id));
	const result = combineSelectedWords(words, ids);
	const timing = combinedTimeRange(merged);
	if (timing) result[range[0]] = { ...result[range[0]], ...timing };
	return { words: result, combined: result[range[0]] };
}
