import {
	getSynchronizableUnits,
	isInSyncLane,
	isSynchronizableLine,
	type SyncLane,
} from "$/modules/lyric-editor/utils/lyric-states";
import type { LyricLine } from "$/types/ttml";
import { withLineBounds } from "./timing-mode";

/** Index of the next line after `lineIndex` that Line-mode keys can land on, or -1. */
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

export function findPrevLineSyncIndex(
	lines: LyricLine[],
	lineIndex: number,
	lane: SyncLane,
): number {
	const from = lines[lineIndex];
	for (let index = lineIndex - 1; index >= 0; index--) {
		const line = lines[index];
		if (
			isSynchronizableLine(line) &&
			(!from || isInSyncLane(from, line, lane)) &&
			getSynchronizableUnits(line).length > 0
		)
			return index;
	}
	return -1;
}

export interface LineSyncResult {
	lines: LyricLine[];
	/** The line to select next, or -1 to keep the selection. */
	nextIndex: number;
}

/** F in Line mode: start this line. */
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

/** G in Line mode: end this line and start the next one at the same time. */
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

/** H in Line mode: end this line and move to the next one without starting it. */
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
