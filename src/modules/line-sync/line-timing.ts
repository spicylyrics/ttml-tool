import type { LyricLine, LyricWord } from "$/types/ttml";

const isTimedWord = (word: LyricWord) =>
	word.word.trim().length > 0 && word.endTime > word.startTime;

/**
 * Whether a word in the line has timing of its own. A line stored as direct
 * text (line-synced TTML, LRC) has one token timed like the line, which
 * doesn't count.
 */
export function lineHasWordTiming(line: LyricLine): boolean {
	const words = line.words.filter((word) => word.word.trim().length > 0);
	if (line.isLineSynced && words.length <= 1) return false;
	return words.some(isTimedWord);
}

/**
 * Whether the song exports as line-timed (`itunes:timing="Line"`): something
 * is timed, and no word has timing of its own, so lines only have a start and
 * an end.
 */
export function isLineTimedSong(lines: readonly LyricLine[]): boolean {
	const hasTiming = lines.some(
		(line) => line.endTime > line.startTime || line.words.some(isTimedWord),
	);
	return hasTiming && !lines.some(lineHasWordTiming);
}

/** A line's words as the plain text a line-timed TTML stores, spacing as typed. */
export function lineText(line: LyricLine): string {
	return line.words.map((word) => word.word).join("");
}
