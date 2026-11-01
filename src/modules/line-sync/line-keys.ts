import {
	getSynchronizableUnits,
	isInSyncLane,
	isSynchronizableLine,
	type SyncLane,
} from "$/modules/lyric-editor/utils/lyric-states";
import type { LyricLine } from "$/types/ttml";

/** Index of the next line after `lineIndex` that the line keys can land on, or -1. */
export function findNextLineSyncIndex(
	lines: LyricLine[],
	lineIndex: number,
	lane: SyncLane,
): number {
	const from = lines[lineIndex];
	return lines.findIndex(
		(line, index) =>
			index > lineIndex &&
			isSynchronizableLine(line) &&
			(!from || isInSyncLane(from, line, lane)) &&
			getSynchronizableUnits(line).length > 0,
	);
}

/**
 * Sets a line's start and end and leaves its words alone. A line stored as
 * direct text (line-synced TTML, LRC) is one token timed like the line, so
 * that token follows.
 */
function withLineBounds(
	line: LyricLine,
	startTime: number,
	endTime: number,
): LyricLine {
	const block =
		line.isLineSynced && line.words.length === 1 ? line.words[0] : undefined;
	return {
		...line,
		startTime,
		endTime,
		words: block ? [{ ...block, startTime, endTime }] : line.words,
	};
}

export interface LineSyncResult {
	lines: LyricLine[];
	/** The line to select next, or -1 to keep the selection. */
	nextIndex: number;
}

/** Start line: sets this line's start. */
export function lineSyncStart(
	lines: LyricLine[],
	lineIndex: number,
	time: number,
): LineSyncResult {
	const line = lines[lineIndex];
	if (!line) return { lines, nextIndex: -1 };
	const next = lines.slice();
	next[lineIndex] = withLineBounds(line, time, line.endTime);
	return { lines: next, nextIndex: -1 };
}

/** End line and start next: ends this line and starts the next at the same time. */
export function lineSyncNext(
	lines: LyricLine[],
	lineIndex: number,
	time: number,
	lane: SyncLane,
): LineSyncResult {
	const line = lines[lineIndex];
	if (!line) return { lines, nextIndex: -1 };
	const next = lines.slice();
	next[lineIndex] = withLineBounds(line, line.startTime, time);
	const nextIndex = findNextLineSyncIndex(lines, lineIndex, lane);
	if (nextIndex !== -1) {
		const following = lines[nextIndex];
		next[nextIndex] = withLineBounds(following, time, following.endTime);
	}
	return { lines: next, nextIndex };
}

/** End line: ends this line and moves to the next one without starting it. */
export function lineSyncEnd(
	lines: LyricLine[],
	lineIndex: number,
	time: number,
	lane: SyncLane,
): LineSyncResult {
	const line = lines[lineIndex];
	if (!line) return { lines, nextIndex: -1 };
	const next = lines.slice();
	next[lineIndex] = withLineBounds(line, line.startTime, time);
	return {
		lines: next,
		nextIndex: findNextLineSyncIndex(lines, lineIndex, lane),
	};
}
