import type { createStore } from "jotai";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";
import type { LyricLine, LyricWord } from "$/types/ttml";

export interface LineLocationResult {
	lines: LyricLine[];
	line: LyricLine;
	lineIndex: number;
}

export interface LineAndWordLocationResult extends LineLocationResult {
	word: LyricWord;
	wordIndex: number;
	syncIndex: number;
	syncId: string;
	isFirstWord: boolean;
	isLastWord: boolean;
}

export interface SyncWordUnit {
	id: string;
	word: LyricWord;
	wordIndex: number;
}

export const getSyncUnitsForLine = (line: LyricLine): SyncWordUnit[] =>
	line.words.map((word, wordIndex) => ({ id: word.id, word, wordIndex }));

export const getSynchronizableUnits = (line: LyricLine) =>
	getSyncUnitsForLine(line).filter((unit) => {
		const text = unit.word.word;
		return text.trim().length > 0;
	});

export const getFirstSynchronizableUnit = (line: LyricLine) =>
	getSynchronizableUnits(line)[0];

export const getLastSynchronizableUnit = (line: LyricLine) => {
	const units = getSynchronizableUnits(line);
	return units[units.length - 1];
};

export function getCurrentLineLocation(
	store: ReturnType<typeof createStore>,
): LineLocationResult | undefined {
	const lyricLines = store.get(lyricLinesAtom).lyricLines;
	const selectedLineId = [...store.get(selectedLinesAtom)][0]; // 进入打轴模式下一般不会出现多选的情况
	if (!selectedLineId) return;
	const lyricLine = lyricLines.findIndex((line) => line.id === selectedLineId);
	if (lyricLine === -1) return;
	return {
		lines: lyricLines,
		line: lyricLines[lyricLine],
		lineIndex: lyricLine,
	};
}

export function getCurrentLocation(
	store: ReturnType<typeof createStore>,
): LineAndWordLocationResult | undefined {
	const lyricLines = store.get(lyricLinesAtom).lyricLines;
	const selectedLineId = [...store.get(selectedLinesAtom)][0]; // 进入打轴模式下一般不会出现多选的情况
	if (!selectedLineId) return;
	const lyricLine = lyricLines.findIndex((line) => line.id === selectedLineId);
	if (lyricLine === -1) return;
	const selectedWordId = [...store.get(selectedWordsAtom)][0];
	if (!selectedWordId) return;
	const line = lyricLines[lyricLine];
	const syncUnits = getSynchronizableUnits(line);
	const syncIndex = syncUnits.findIndex((unit) => unit.id === selectedWordId);
	if (syncIndex === -1) return;
	const targetUnit = syncUnits[syncIndex];
	if (!targetUnit) return;
	const isFirstWord = syncIndex === 0;
	const isLastWord = syncIndex === syncUnits.length - 1;
	return {
		lines: lyricLines,
		line,
		lineIndex: lyricLine,
		word: targetUnit.word,
		wordIndex: targetUnit.wordIndex,
		syncIndex,
		syncId: targetUnit.id,
		isFirstWord,
		isLastWord,
	};
}

export const isSynchronizableLine = (line: LyricLine) => !line.ignoreSync;

/**
 * Which lines keyboard sync may move to: any line, or only lines of the same
 * main or background kind as the current one.
 */
export type SyncLane = "all" | "same";

export const isInSyncLane = (from: LyricLine, to: LyricLine, lane: SyncLane) =>
	lane !== "same" || !!from.isBG === !!to.isBG;

export function findNextWord(
	lyricLines: LyricLine[],
	lineIndex: number,
	syncIndex: number,
	lane: SyncLane = "all",
):
	| {
			unit: SyncWordUnit;
			line: LyricLine;
			lineIndex: number;
			syncIndex: number;
	  }
	| undefined {
	const line = lyricLines[lineIndex];
	if (!line) return;
	const units = getSynchronizableUnits(line);
	const nextUnit = units[syncIndex + 1];
	if (nextUnit) {
		return {
			line,
			lineIndex,
			unit: nextUnit,
			syncIndex: syncIndex + 1,
		};
	}
	let absoluteIndex = -1;
	for (let i = lineIndex + 1; i < lyricLines.length; i++) {
		const nextLine = lyricLines[i];
		if (
			isSynchronizableLine(nextLine) &&
			isInSyncLane(line, nextLine, lane) &&
			getSynchronizableUnits(nextLine).length > 0
		) {
			absoluteIndex = i;
			break;
		}
	}

	if (absoluteIndex === -1) return;
	const nextLine = lyricLines[absoluteIndex];
	const nextLineUnits = getSynchronizableUnits(nextLine);
	const firstUnit = nextLineUnits[0];
	if (!firstUnit) return;
	return {
		line: nextLine,
		lineIndex: absoluteIndex,
		unit: firstUnit,
		syncIndex: 0,
	};
}
