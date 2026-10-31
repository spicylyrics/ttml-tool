import { atom } from "jotai";
import type { ProcessedLyricLine } from "$/modules/segmentation/utils/segment-processing.ts";
import type { DividerEdge } from "$/modules/spectrogram/utils/timeline-mutations.ts";

type DividerDragOperation = {
	type: "divider";
	lineId: string;
	segmentIndex: number;
	edge: DividerEdge;
	zoom: number;
	startX: number;
	isGapCreation: boolean;
	virtual?: boolean;
	/** Set by a merged line-end handle: moves the last word's end and the line end together. */
	mergedLineEnd?: boolean;
};

type WordPanOperation = {
	type: "word-pan";
	lineId: string;
	wordId: string;
	initialMouseTimeMS: number;
	initialWordStartMS: number;
};

type LinePanOperation = {
	type: "line-pan";
	lineId: string;
	initialMouseTimeMS: number;
	initialLineStartMS: number;
};

export type TimelineDragOperation =
	| DividerDragOperation
	| WordPanOperation
	| LinePanOperation;

export const timelineDragAtom = atom<TimelineDragOperation | null>(null);

export const previewLineAtom = atom<ProcessedLyricLine | null>(null);

export const isDraggingAtom = atom((get) => get(timelineDragAtom) !== null);

export const selectedWordIdAtom = atom<string | null>(null);
