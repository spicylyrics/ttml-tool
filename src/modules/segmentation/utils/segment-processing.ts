import { atom } from "jotai";
import { lyricLinesAtom } from "$/states/main.ts";
import type { LyricLine, LyricWord } from "$/types/ttml";

export interface WordSegment extends LyricWord {
	type: "word";
}

export interface GapSegment {
	type: "gap";
	id: string;
	startTime: number;
	endTime: number;
}

export type ProcessedSegment = WordSegment | GapSegment;

export interface ProcessedLyricLine extends Omit<LyricLine, "words"> {
	segments: ProcessedSegment[];
}

export function processSingleLine(line: LyricLine): ProcessedLyricLine {
	const segments: ProcessedSegment[] = [];

	const rawWordSegments: WordSegment[] = line.words.map((word) => ({
		...word,
		type: "word",
	}));

	const validWords = rawWordSegments
		.filter((w) => w.endTime > w.startTime)
		.sort((a, b) => a.startTime - b.startTime || a.endTime - b.endTime);

	let cursor = line.startTime;

	for (const word of validWords) {
		if (word.startTime > cursor) {
			segments.push({
				type: "gap",
				id: `${line.id}-gap-${cursor}`,
				startTime: cursor,
				endTime: word.startTime,
			});
		}

		segments.push({ ...word, type: "word" });

		// A word nested inside an earlier one must not move the cursor back,
		// or a phantom gap gets drawn over the longer word.
		cursor = Math.max(cursor, word.endTime);
	}

	if (line.endTime > cursor) {
		segments.push({
			type: "gap",
			id: `${line.id}-gap-end`,
			startTime: cursor,
			endTime: line.endTime,
		});
	}

	return {
		...line,
		segments: segments,
	};
}

// Atom updates must replace edited line objects (as Immer and keyboard sync do).
const processedLineCache = new WeakMap<LyricLine, ProcessedLyricLine>();

function createProcessedLyricLines(
	dirtyLines: LyricLine[],
): ProcessedLyricLine[] {
	return dirtyLines.map((line) => {
		let processed = processedLineCache.get(line);
		if (!processed) {
			processed = processSingleLine(line);
			processedLineCache.set(line, processed);
		}
		return processed;
	});
}

export const processedLyricLinesAtom = atom<ProcessedLyricLine[]>((get) => {
	const { lyricLines } = get(lyricLinesAtom);
	if (!lyricLines) return [];
	return createProcessedLyricLines(lyricLines);
});
