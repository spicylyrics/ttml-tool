import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";

export const DEFAULT_NUDGE_STEP_MS = 10;
export const MIN_NUDGE_STEP_MS = 1;
export const MAX_NUDGE_STEP_MS = 500;
/** Shift multiplies the step; Alt always moves by one millisecond. */
export const NUDGE_SHIFT_FACTOR = 10;
export const NUDGE_FINE_STEP_MS = 1;

const MIN_WORD_DURATION_MS = 10;

/** Milliseconds one nudge press moves, a whole number kept in range. */
export function clampNudgeStep(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_NUDGE_STEP_MS;
	return Math.min(
		MAX_NUDGE_STEP_MS,
		Math.max(MIN_NUDGE_STEP_MS, Math.round(value)),
	);
}

const isUntimed = (word: LyricWord) =>
	word.startTime === 0 && word.endTime === 0;
const isMovable = (word: LyricWord) =>
	!isUntimed(word) && word.word.trim().length > 0;

/**
 * Moves one word's start by `deltaMs`. A previous word that ends exactly where
 * this one starts moves its end along, like dragging the divider between them;
 * across a gap the start stops at the previous word's end, so they connect.
 * The start never passes the previous word's start or its own end, and the
 * line's start follows when this word owns it.
 */
export function nudgeWordStart(
	line: LyricLine,
	wordId: string,
	deltaMs: number,
): LyricLine {
	const index = line.words.findIndex((word) => word.id === wordId);
	const word = line.words[index];
	if (!word || !isMovable(word)) return line;

	let previousIndex = index - 1;
	while (previousIndex >= 0 && !isMovable(line.words[previousIndex]))
		previousIndex--;
	const previous = line.words[previousIndex];

	const min = previous ? previous.startTime + MIN_WORD_DURATION_MS : 0;
	const max = Math.max(word.startTime, word.endTime - MIN_WORD_DURATION_MS);
	let start = Math.min(
		max,
		Math.max(min, Math.round(word.startTime + deltaMs)),
	);
	// Closing a gap stops where the words meet instead of overlapping them.
	if (previous && previous.endTime < word.startTime && start < previous.endTime)
		start = previous.endTime;
	if (start === word.startTime) return line;

	const words = line.words.slice();
	words[index] = { ...word, startTime: start };
	if (previous && previous.endTime === word.startTime)
		words[previousIndex] = { ...previous, endTime: start };

	const ownsLineStart = word.startTime <= line.startTime;
	const lineStart =
		ownsLineStart || start < line.startTime
			? Math.min(
					...words.filter(isMovable).map((candidate) => candidate.startTime),
				)
			: line.startTime;

	return { ...line, startTime: lineStart, words };
}

/**
 * Moves one word's end by `deltaMs`. A next word that starts exactly where
 * this one ends moves its start along; across a gap the end stops at the next
 * word's start, so they connect. The end never passes its own start or the
 * next word's end, and the line's end follows when this word owns it.
 */
export function nudgeWordEnd(
	line: LyricLine,
	wordId: string,
	deltaMs: number,
): LyricLine {
	const index = line.words.findIndex((word) => word.id === wordId);
	const word = line.words[index];
	if (!word || !isMovable(word)) return line;

	let nextIndex = index + 1;
	while (nextIndex < line.words.length && !isMovable(line.words[nextIndex]))
		nextIndex++;
	const next = line.words[nextIndex];

	const min = Math.min(word.endTime, word.startTime + MIN_WORD_DURATION_MS);
	const max = next
		? next.endTime - MIN_WORD_DURATION_MS
		: Number.POSITIVE_INFINITY;
	let end = Math.min(max, Math.max(min, Math.round(word.endTime + deltaMs)));
	// Closing a gap stops where the words meet instead of overlapping them.
	if (next && word.endTime < next.startTime && end > next.startTime)
		end = next.startTime;
	if (end === word.endTime) return line;

	const words = line.words.slice();
	words[index] = { ...word, endTime: end };
	if (next && next.startTime === word.endTime)
		words[nextIndex] = { ...next, startTime: end };

	const ownsLineEnd = word.endTime >= line.endTime;
	const lineEnd =
		ownsLineEnd || end > line.endTime
			? Math.max(
					...words.filter(isMovable).map((candidate) => candidate.endTime),
				)
			: line.endTime;

	return { ...line, endTime: lineEnd, words };
}

/** Moves a whole timed line, words included, never before 0. */
export function nudgeLine(line: LyricLine, deltaMs: number): LyricLine {
	if (line.startTime === 0 && line.endTime === 0) return line;
	const start = Math.max(0, Math.round(line.startTime + deltaMs));
	const delta = start - line.startTime;
	if (delta === 0) return line;
	return {
		...line,
		startTime: start,
		endTime: line.endTime + delta,
		words: line.words.map((word) =>
			isUntimed(word)
				? word
				: {
						...word,
						startTime: word.startTime + delta,
						endTime: word.endTime + delta,
					},
		),
	};
}

export type NudgeEdge = "start" | "end";

/**
 * Nudges the selected words' starts or ends. With no word selected, a start
 * nudge moves the selected lines and an end nudge does nothing. Returns the
 * same document when nothing moved, so no undo step is added.
 */
export function nudgeSelection(
	doc: TTMLLyric,
	selection: { lines: ReadonlySet<string>; words: ReadonlySet<string> },
	deltaMs: number,
	edge: NudgeEdge = "start",
): TTMLLyric {
	const byWords = doc.lyricLines.some((line) =>
		line.words.some((word) => selection.words.has(word.id)),
	);
	const nudgeWord = edge === "start" ? nudgeWordStart : nudgeWordEnd;
	let changed = false;
	const lyricLines = doc.lyricLines.map((line) => {
		let next = line;
		if (byWords) {
			for (const word of line.words)
				if (selection.words.has(word.id))
					next = nudgeWord(next, word.id, deltaMs);
		} else if (edge === "start" && selection.lines.has(line.id)) {
			next = nudgeLine(line, deltaMs);
		}
		if (next !== line) changed = true;
		return next;
	});
	return changed ? { ...doc, lyricLines } : doc;
}
