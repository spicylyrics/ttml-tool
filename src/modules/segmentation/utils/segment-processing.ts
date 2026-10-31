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
	/** A word has a start but no end yet: keyboard sync is mid-line. */
	syncInProgress?: boolean;
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

	// Keyboard sync commits each word/syllable before it closes the line.
	// Include those completed spans in the display bounds without changing
	// the stored line timing (which may still be unset or from an earlier pass).
	let startTime = line.startTime;
	// Both zero means the line itself is still untimed. Do not draw an
	// artificial leading gap from 0:00 when only its words have timestamps.
	if (line.startTime === 0 && line.endTime === 0 && validWords.length > 0) {
		startTime = validWords[0].startTime;
	}
	let endTime = line.endTime;
	for (const word of validWords) {
		startTime = Math.min(startTime, word.startTime);
		endTime = Math.max(endTime, word.endTime);
	}

	let cursor = startTime;

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

	if (endTime > cursor) {
		segments.push({
			type: "gap",
			id: `${line.id}-gap-end`,
			startTime: cursor,
			endTime,
		});
	}

	return {
		...line,
		startTime,
		endTime,
		segments: segments,
		syncInProgress: line.words.some(
			(w) => w.startTime > 0 && w.endTime <= w.startTime,
		),
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
