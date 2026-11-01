import { distributeLineTime } from "$/modules/lyric-editor/utils/distribute-time";
import { type LyricLine, type LyricWord, newLyricWord } from "$/types/ttml";

const isTimedWord = (word: LyricWord) =>
	word.word.trim().length > 0 && word.endTime > word.startTime;

const hasText = (line: LyricLine) =>
	line.words.some((word) => word.word.trim().length > 0);

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

/** A line with text and a start and end, but no word timing of its own. */
export function isLineOnly(line: LyricLine): boolean {
	return (
		line.endTime > line.startTime && hasText(line) && !lineHasWordTiming(line)
	);
}

/**
 * How the song is timed, which is how it exports:
 * - `word`: words have their own timing.
 * - `line`: lines only have a start and end (`itunes:timing="Line"`).
 * - `mixed`: some lines are timed only as a whole while others have word
 *   timing. It exports as Word with those lines as plain text; Spicy Lyrics
 *   expects one style per song.
 * - `none`: nothing is timed.
 */
export type SongTiming = "word" | "line" | "mixed" | "none";

const textWords = (line: LyricLine) =>
	line.words.filter((word) => word.word.trim().length > 0);

/**
 * A one-word line timed as a whole ("Yeah") is word and line timing at once,
 * so it never decides the style. Only these do: a line of several words with
 * just a start and end, and a word timed apart from its line.
 */
const showsLineTiming = (line: LyricLine) =>
	isLineOnly(line) && textWords(line).length > 1;

function showsWordTiming(line: LyricLine): boolean {
	if (!lineHasWordTiming(line)) return false;
	const words = textWords(line);
	return !(
		words.length === 1 &&
		words[0].startTime === line.startTime &&
		words[0].endTime === line.endTime
	);
}

export function getSongTiming(lines: readonly LyricLine[]): SongTiming {
	const word = lines.some(showsWordTiming);
	const line = lines.some(showsLineTiming);
	if (word && line) return "mixed";
	if (word) return "word";
	if (line) return "line";
	// Only one-word lines are timed: keep the style they came in with, word
	// timed tokens as Word and lines stored as text as Line.
	const timed = lines.filter(
		(l) => l.endTime > l.startTime || l.words.some(isTimedWord),
	);
	if (!timed.length) return "none";
	return timed.some(lineHasWordTiming) ? "word" : "line";
}

/** Whether the song exports as line-timed (`itunes:timing="Line"`). */
export function isLineTimedSong(lines: readonly LyricLine[]): boolean {
	return getSongTiming(lines) === "line";
}

/** A line's words as the plain text a line-timed TTML stores, spacing as typed. */
export function lineText(line: LyricLine): string {
	return line.words.map((word) => word.word).join("");
}

/** A line stored as one block of text, split at its spaces into words. */
function splitBlock(line: LyricLine): LyricLine {
	if (!line.isLineSynced || line.words.length !== 1) return line;
	const [block] = line.words;
	const words = block.word
		.split(/(\s+)/)
		.filter((part) => part.length > 0)
		.map((part, index) => ({
			...newLyricWord(),
			...(index === 0 ? { id: block.id } : {}),
			word: part,
		}));
	return { ...line, isLineSynced: false, words };
}

/**
 * Mixed fix: every line timed only as a whole gets its time spread across its
 * words by letter count, so the whole song is word timed. Lines stored as one
 * block of text are split at their spaces first.
 */
export function spreadLineOnlyLines(lines: LyricLine[]): LyricLine[] {
	return lines.map((line) =>
		isLineOnly(line)
			? distributeLineTime(splitBlock(line), line.startTime, line.endTime, {
					weight: "characters",
				})
			: line,
	);
}

/** Mixed fix: drop all word timing and keep line starts and ends, so the song is line timed. */
export function clearWordTiming(lines: LyricLine[]): LyricLine[] {
	return lines.map((line) =>
		lineHasWordTiming(line)
			? {
					...line,
					words: line.words.map((word) => ({
						...word,
						startTime: 0,
						endTime: 0,
					})),
				}
			: line,
	);
}
