import type { LyricLine } from "$/types/ttml";

export interface WordTimingSnapshot {
	startTime: number;
	endTime: number;
}

export interface LineTimingSnapshot {
	sourceLineId: string;
	startTime: number;
	endTime: number;
	words: WordTimingSnapshot[];
}

export interface ApplyLineTimingsResult {
	appliedLineCount: number;
	partial: boolean;
	wordCountMismatchCount: number;
	/**
	 * No timed line at or above the target to line up with, so the copied
	 * timings keep the times they had at the source.
	 */
	usedOriginalTimes?: boolean;
}

// An untimed line or word is 0/0; a real timing never ends at 0.
const isTimed = (item: { startTime: number; endTime: number }) =>
	item.startTime > 0 || item.endTime > 0;

/**
 * Where the copy should start: the target's own start when it is timed,
 * otherwise the end of the nearest timed line above it, or null when nothing
 * above is timed.
 */
function findPasteAnchor(lines: LyricLine[], targetIndex: number) {
	if (isTimed(lines[targetIndex])) return lines[targetIndex].startTime;
	for (let i = targetIndex - 1; i >= 0; i--) {
		if (isTimed(lines[i])) return lines[i].endTime;
	}
	return null;
}

export function createLineTimingSnapshots(
	lines: LyricLine[],
	selectedLineIds: ReadonlySet<string>,
): LineTimingSnapshot[] {
	return lines
		.filter((line) => selectedLineIds.has(line.id))
		.map((line) => ({
			sourceLineId: line.id,
			startTime: line.startTime,
			endTime: line.endTime,
			words: line.words.map((word) => ({
				startTime: word.startTime,
				endTime: word.endTime,
			})),
		}));
}

export function applyLineTimingSnapshots(
	lines: LyricLine[],
	targetStartIndex: number,
	snapshots: LineTimingSnapshot[],
): ApplyLineTimingsResult {
	if (
		targetStartIndex < 0 ||
		targetStartIndex >= lines.length ||
		snapshots.length === 0
	) {
		return {
			appliedLineCount: 0,
			partial: snapshots.length > 0,
			wordCountMismatchCount: 0,
		};
	}

	const appliedLineCount = Math.min(
		snapshots.length,
		lines.length - targetStartIndex,
	);
	let wordCountMismatchCount = 0;

	// Move the whole copy so its first timed line starts at the anchor; the gaps
	// between the copied lines stay as they were.
	const firstTimed = snapshots.find(isTimed);
	const anchor = findPasteAnchor(lines, targetStartIndex);
	const usedOriginalTimes = anchor === null && firstTimed !== undefined;
	const shift =
		anchor === null || !firstTimed ? 0 : anchor - firstTimed.startTime;
	const moved = (time: { startTime: number; endTime: number }) =>
		isTimed(time)
			? {
					startTime: Math.max(0, time.startTime + shift),
					endTime: Math.max(0, time.endTime + shift),
				}
			: { startTime: 0, endTime: 0 };

	for (let offset = 0; offset < appliedLineCount; offset++) {
		const target = lines[targetStartIndex + offset];
		const snapshot = snapshots[offset];
		Object.assign(target, moved(snapshot));

		if (target.words.length !== snapshot.words.length) {
			wordCountMismatchCount++;
		}
		const copiedWordCount = Math.min(
			target.words.length,
			snapshot.words.length,
		);
		for (let wordIndex = 0; wordIndex < copiedWordCount; wordIndex++) {
			Object.assign(target.words[wordIndex], moved(snapshot.words[wordIndex]));
		}
	}

	return {
		appliedLineCount,
		partial: appliedLineCount < snapshots.length,
		wordCountMismatchCount,
		usedOriginalTimes,
	};
}

export function snapSelectedLineTimingsToTime(
	lines: LyricLine[],
	selectedLineIds: ReadonlySet<string>,
	targetStartTime: number,
): number {
	const selectedLines = lines.filter((line) => selectedLineIds.has(line.id));
	if (selectedLines.length === 0) return 0;

	const offset = targetStartTime - selectedLines[0].startTime;
	for (const line of selectedLines) {
		line.startTime += offset;
		line.endTime += offset;
		for (const word of line.words) {
			word.startTime += offset;
			word.endTime += offset;
		}
	}
	return selectedLines.length;
}
