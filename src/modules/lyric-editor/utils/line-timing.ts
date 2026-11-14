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

	for (let offset = 0; offset < appliedLineCount; offset++) {
		const target = lines[targetStartIndex + offset];
		const snapshot = snapshots[offset];
		target.startTime = snapshot.startTime;
		target.endTime = snapshot.endTime;

		if (target.words.length !== snapshot.words.length) {
			wordCountMismatchCount++;
		}
		const copiedWordCount = Math.min(
			target.words.length,
			snapshot.words.length,
		);
		for (let wordIndex = 0; wordIndex < copiedWordCount; wordIndex++) {
			target.words[wordIndex].startTime = snapshot.words[wordIndex].startTime;
			target.words[wordIndex].endTime = snapshot.words[wordIndex].endTime;
		}
	}

	return {
		appliedLineCount,
		partial: appliedLineCount < snapshots.length,
		wordCountMismatchCount,
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
