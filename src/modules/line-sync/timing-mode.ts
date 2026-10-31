import { distributeLineTime } from "$/modules/lyric-editor/utils/distribute-time";
import {
	type LyricLine,
	type LyricWord,
	newLyricWord,
	type TimingMode,
	type TTMLLyric,
} from "$/types/ttml";

/** Projects saved before line syncing existed have no mode and are word timed. */
export function getTimingMode(
	lyric: Pick<TTMLLyric, "timingMode">,
): TimingMode {
	return lyric.timingMode === "line" ? "line" : "word";
}

const isBlank = (word: LyricWord) => word.word.trim().length === 0;

const boundsOf = (start: number, end: number): LyricLine["syncedLineBounds"] =>
	end > start ? { startTime: start, endTime: end } : undefined;

/** Whether the line is already one block of text timed like the line. */
export function isLineBlock(line: LyricLine): boolean {
	if (!line.isLineSynced || line.words.length > 1) return false;
	const word = line.words[0];
	return (
		!word ||
		(word.startTime === line.startTime && word.endTime === line.endTime)
	);
}

/** Word tokens as one text: syllables join, spaces stay as they were. */
const joinTokens = (words: LyricWord[]) =>
	words
		.map((word) => word.word)
		.join("")
		.trim();

/**
 * Text added to a block (a word inserted before or after it) is a separate
 * word, never a syllable, so it gets a space where none was typed.
 */
const joinWithSpaces = (words: LyricWord[]) =>
	words
		.map((word) => word.word)
		.filter((text) => text.length > 0)
		.reduce(
			(text, part) =>
				!text || /\s$/.test(text) || /^\s/.test(part)
					? text + part
					: `${text} ${part}`,
			"",
		)
		.trim();

/**
 * Line mode keeps every line as one block: a single token with the whole text,
 * timed like the line, the same shape line-synced TTML and LRC open as. Word
 * romanizations move to the line's romanization when it has none.
 */
export function toLineBlock(
	line: LyricLine,
	startTime = line.startTime,
	endTime = line.endTime,
	join: (words: LyricWord[]) => string = joinTokens,
): LyricLine {
	if (
		isLineBlock(line) &&
		startTime === line.startTime &&
		endTime === line.endTime
	)
		return line;
	const first = line.words.find((word) => !isBlank(word)) ?? line.words[0];
	const romanLyric =
		line.romanLyric ||
		line.words
			.map((word) => word.romanWord.trim())
			.filter(Boolean)
			.join(" ");
	const { syncedLineBounds: _bounds, ...rest } = line;
	return {
		...rest,
		startTime,
		endTime,
		isLineSynced: true,
		romanLyric,
		words: first
			? [
					{
						...newLyricWord(),
						id: first.id,
						word: join(line.words),
						startTime,
						endTime,
					},
				]
			: [],
	};
}

/** Sets a Line-mode line's start and end. */
export function withLineBounds(
	line: LyricLine,
	start: number,
	end: number,
): LyricLine {
	return toLineBlock(line, start, end);
}

/** Whether any word in the line is timed apart from the line itself. */
export function lineHasWordTimings(line: LyricLine): boolean {
	return line.words.some(
		(word) =>
			!isBlank(word) &&
			word.endTime > word.startTime &&
			(word.startTime !== line.startTime || word.endTime !== line.endTime),
	);
}

/** Whether switching to Line mode would throw away any word timing. */
export function hasWordTimings(lyric: TTMLLyric): boolean {
	return lyric.lyricLines.some(lineHasWordTimings);
}

/** Whether switching to Line mode would change anything but the mode. */
export function hasWordStructure(lyric: TTMLLyric): boolean {
	return lyric.lyricLines.some(
		(line) => line.words.filter((word) => !isBlank(word)).length > 1,
	);
}

/** The line's bounds, or the span of its timed words when the line has none. */
function lineSpan(line: LyricLine) {
	if (line.endTime > line.startTime)
		return { start: line.startTime, end: line.endTime };
	const timed = line.words.filter(
		(word) => !isBlank(word) && word.endTime > word.startTime,
	);
	if (timed.length === 0) return { start: line.startTime, end: line.endTime };
	return {
		start: Math.min(...timed.map((word) => word.startTime)),
		end: Math.max(...timed.map((word) => word.endTime)),
	};
}

/** Word → Line: every line becomes one block, keeping its start and end. */
export function switchToLineMode(lyric: TTMLLyric): TTMLLyric {
	return {
		...lyric,
		timingMode: "line",
		lyricLines: lyric.lyricLines.map((line) => {
			const { start, end } = lineSpan(line);
			return toLineBlock(line, start, end);
		}),
	};
}

export interface SwitchToWordOptions {
	/** Spread each timed line's time across its words by letter count. */
	spread?: boolean;
}

/**
 * Line → Word: split each block into words at spaces. The line bounds are kept
 * as synced bounds, so word syncing stays inside them (R48). Without `spread`
 * every word starts untimed. The mode is dropped rather than stored as
 * "word", the same as a song from before Line mode existed.
 */
export function switchToWordMode(
	lyric: TTMLLyric,
	{ spread = false }: SwitchToWordOptions = {},
): TTMLLyric {
	const { timingMode: _mode, ...rest } = lyric;
	return {
		...rest,
		lyricLines: lyric.lyricLines.map((line) => {
			const words =
				line.words.length === 1
					? splitLineText(line.words[0].word, 0, 0, line.words[0].id)
					: line.words.map((word) => ({ ...word, startTime: 0, endTime: 0 }));
			const timed = line.endTime > line.startTime;
			const split: LyricLine = {
				...line,
				isLineSynced: words.filter((word) => !isBlank(word)).length <= 1,
				syncedLineBounds: boundsOf(line.startTime, line.endTime),
				words,
			};
			if (!spread || !timed || words.length === 0) return split;
			return {
				...distributeLineTime(split, line.startTime, line.endTime, {
					weight: "characters",
				}),
				startTime: line.startTime,
				endTime: line.endTime,
			};
		}),
	};
}

/**
 * Splits a line's text into word and space tokens that all carry the given
 * time. The first word keeps `firstId`, so a selection on the block survives.
 */
export function splitLineText(
	text: string,
	startTime: number,
	endTime: number,
	firstId?: string,
): LyricWord[] {
	let idUsed = !firstId;
	return text
		.split(/(\s+)/)
		.filter((part) => part.length > 0)
		.map((part) => {
			const blank = part.trim().length === 0;
			const word = {
				...newLyricWord(),
				word: part,
				startTime: blank ? 0 : startTime,
				endTime: blank ? 0 : endTime,
			};
			if (!blank && !idUsed && firstId) {
				word.id = firstId;
				idUsed = true;
			}
			return word;
		});
}

/**
 * Keeps a Line-mode song in blocks whatever edited it: a line that gained
 * words (typed, pasted, imported, split) is joined back into one block. When
 * an edit moved only the block itself, the line follows it; otherwise the
 * block follows the line. Returns `next` unchanged when nothing needs fixing.
 */
export function keepLineBlocks(prev: TTMLLyric, next: TTMLLyric): TTMLLyric {
	if (getTimingMode(next) !== "line") return next;
	let lines: LyricLine[] | undefined;
	next.lyricLines.forEach((line, index) => {
		if (isLineBlock(line)) return;
		const before = prev.lyricLines[index];
		const block = line.words.length === 1 ? line.words[0] : undefined;
		const blockMoved =
			!!block &&
			before?.id === line.id &&
			before.startTime === line.startTime &&
			before.endTime === line.endTime;
		lines ??= next.lyricLines.slice();
		lines[index] =
			blockMoved && block
				? toLineBlock(line, block.startTime, block.endTime)
				: toLineBlock(line, line.startTime, line.endTime, joinWithSpaces);
	});
	return lines ? { ...next, lyricLines: lines } : next;
}

/**
 * Whether R48 applies to the line. The bounds are recorded when they are
 * synced; once the line's start or end is changed any other way (a typed time,
 * a drag, Clear timing), they no longer match and the clamp stops applying.
 */
export function hasSyncedLineBounds(line: LyricLine): boolean {
	const bounds = line.syncedLineBounds;
	return (
		!!bounds &&
		bounds.endTime > bounds.startTime &&
		line.startTime === bounds.startTime &&
		line.endTime === bounds.endTime
	);
}

const clamp = (value: number, min: number, max: number) =>
	Math.min(max, Math.max(min, value));

/**
 * R48: once a line's bounds were synced, word syncing stays inside them. Runs
 * after a word-sync key press: every line the press changed gets its synced
 * bounds back, and every word the press changed is clamped into them. A G on
 * the last word past the line's end therefore ends the word at the line's end
 * and moves on to the next line, whose first word can't start before that
 * line's own start.
 */
export function clampToSyncedLineBounds(
	prev: TTMLLyric,
	next: TTMLLyric,
): TTMLLyric {
	if (prev.lyricLines.length !== next.lyricLines.length) return next;
	let lines: LyricLine[] | undefined;
	next.lyricLines.forEach((line, index) => {
		const before = prev.lyricLines[index];
		if (line === before || before.id !== line.id) return;
		if (!hasSyncedLineBounds(before)) return;
		const { startTime: start, endTime: end } = before;
		const words = line.words.map((word, wordIndex) => {
			const old = before.words[wordIndex];
			if (word === old) return word;
			// Only the times this press set; an end still at 0 is unsynced, not early.
			const startTime =
				old && word.startTime === old.startTime
					? word.startTime
					: clamp(word.startTime, start, end);
			const endTime =
				old && word.endTime === old.endTime
					? word.endTime
					: clamp(word.endTime, start, end);
			if (startTime === word.startTime && endTime === word.endTime) return word;
			return { ...word, startTime, endTime };
		});
		lines ??= next.lyricLines.slice();
		lines[index] = { ...line, startTime: start, endTime: end, words };
	});
	return lines ? { ...next, lyricLines: lines } : next;
}
