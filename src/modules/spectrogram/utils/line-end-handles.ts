import type {
	ProcessedLyricLine,
	ProcessedSegment,
	WordSegment,
} from "$/modules/segmentation/utils/segment-processing";

/**
 * A line end and its last word's end closer than this count as one point and
 * get one handle. Small enough that a deliberate trailing gap stays separate.
 */
export const LINE_END_MERGE_TOLERANCE_MS = 20;

/** Visual handle width the classic divider uses. */
export const LINE_END_BASE_HIT_PX = 15;
/** Hit width for the line-end handles while the flag is on. The bar stays 2px. */
export const LINE_END_WIDE_HIT_PX = 23;

const MIN_WORD_DURATION_MS = 10;

/**
 * How the end of a line is drawn.
 *
 * - `merged`: the last word ends at (or within tolerance of) the line end. One
 *   handle at the line end moves both. `wordIndex` is the last word,
 *   `gapIndex` the tiny trailing gap between them, if any.
 * - `split`: a real trailing gap. Two handles: the word end (divider after
 *   `wordIndex`) and the line end (divider after `gapIndex`).
 * - `none`: anything else (no words, a word running past the line end, a
 *   nested word). The classic dividers handle it.
 */
export type LineEndHandles =
	| { kind: "merged"; wordIndex: number; gapIndex: number | null }
	| { kind: "split"; wordIndex: number; gapIndex: number }
	| { kind: "none" };

const NONE: LineEndHandles = { kind: "none" };

export function resolveLineEndHandles(
	segments: readonly ProcessedSegment[],
	lineEndTime: number,
	toleranceMs = LINE_END_MERGE_TOLERANCE_MS,
): LineEndHandles {
	const lastIndex = segments.length - 1;
	const last = segments[lastIndex];
	if (!last) return NONE;

	if (last.type === "word") {
		return last.endTime === lineEndTime
			? { kind: "merged", wordIndex: lastIndex, gapIndex: null }
			: NONE;
	}

	const word = segments[lastIndex - 1];
	if (!word || word.type !== "word" || word.endTime !== last.startTime) {
		return NONE;
	}
	const gapMs = last.endTime - last.startTime;
	return gapMs <= toleranceMs
		? { kind: "merged", wordIndex: lastIndex - 1, gapIndex: lastIndex }
		: { kind: "split", wordIndex: lastIndex - 1, gapIndex: lastIndex };
}

/**
 * Moves a merged line end.
 *
 * Without `separate`, the last word's end and the line end both go to
 * `newTime`, and any tiny trailing gap closes. With `separate` (Alt), they are
 * pulled apart: dragging right moves only the line end, dragging left moves
 * only the word end, so a trailing gap opens either way.
 */
export function getUpdatedLineForMergedEnd(
	line: ProcessedLyricLine,
	newTime: number,
	separate = false,
): ProcessedLyricLine {
	const handles = resolveLineEndHandles(line.segments, line.endTime);
	if (handles.kind !== "merged") return line;

	const word = line.segments[handles.wordIndex] as WordSegment;
	const minEnd = word.startTime + MIN_WORD_DURATION_MS;
	const otherEnds = line.segments
		.filter((s): s is WordSegment => s.type === "word" && s.id !== word.id)
		.map((s) => s.endTime);

	let wordEnd: number;
	let lineEnd: number;
	if (separate && newTime >= line.endTime) {
		wordEnd = word.endTime;
		lineEnd = newTime;
	} else if (separate) {
		wordEnd = Math.min(Math.max(newTime, minEnd), word.endTime);
		lineEnd = line.endTime;
	} else {
		wordEnd = Math.max(newTime, minEnd);
		lineEnd = Math.max(wordEnd, ...otherEnds);
	}

	const segments: ProcessedSegment[] = line.segments.slice(
		0,
		handles.wordIndex,
	);
	segments.push({ ...word, endTime: wordEnd });
	if (lineEnd > wordEnd) {
		segments.push({
			type: "gap",
			id: `${line.id}-gap-end`,
			startTime: wordEnd,
			endTime: lineEnd,
		});
	}

	return { ...line, endTime: lineEnd, segments };
}

export interface HitZone {
	/** Left edge relative to the handle's time position, in px. */
	offsetPx: number;
	widthPx: number;
}

/**
 * Hit zones for split word-end and line-end handles `distancePx` apart.
 *
 * Each zone is `hitWidthPx` wide around its handle, but neither crosses the
 * midpoint between them, so the closer handle always wins. A line end
 * touching the next line keeps its zone inside its own line.
 */
export function getSplitHitZones(
	distancePx: number,
	lineEndTouching: boolean,
	hitWidthPx = LINE_END_WIDE_HIT_PX,
): { word: HitZone; line: HitZone } {
	const half = hitWidthPx / 2;
	const mid = Math.max(0, distancePx / 2);

	const wordLeft = -half;
	const wordRight = Math.min(half, mid);

	const lineLeft = Math.max(-half, -mid);
	const lineRight = lineEndTouching ? 0 : half;
	const lineLeftTouching = lineEndTouching
		? Math.max(-hitWidthPx, -mid)
		: lineLeft;

	return {
		word: { offsetPx: wordLeft, widthPx: wordRight - wordLeft },
		line: {
			offsetPx: lineLeftTouching,
			widthPx: lineRight - lineLeftTouching,
		},
	};
}

export interface LineEndDividerProps {
	lineEndRole: "merged" | "word" | "line";
	hitOffsetPx: number;
	hitWidthPx: number;
}

/**
 * Which end-of-line dividers to hide and how to draw the rest, keyed by the
 * index of the segment each divider follows. Null leaves the classic dividers.
 */
export function getLineEndDividers(
	segments: readonly ProcessedSegment[],
	lineEndTime: number,
	zoom: number,
	lineEndTouching: boolean,
): {
	hidden: ReadonlySet<number>;
	props: ReadonlyMap<number, LineEndDividerProps>;
} | null {
	const handles = resolveLineEndHandles(segments, lineEndTime);
	if (handles.kind === "none") return null;

	if (handles.kind === "merged") {
		const zone = getMergedHitZone(lineEndTouching);
		const props = new Map<number, LineEndDividerProps>([
			[
				handles.gapIndex ?? handles.wordIndex,
				{
					lineEndRole: "merged",
					hitOffsetPx: zone.offsetPx,
					hitWidthPx: zone.widthPx,
				},
			],
		]);
		const hidden = new Set<number>(
			handles.gapIndex === null ? [] : [handles.wordIndex],
		);
		return { hidden, props };
	}

	const gap = segments[handles.gapIndex];
	const distancePx = ((gap.endTime - gap.startTime) / 1000) * zoom;
	const zones = getSplitHitZones(distancePx, lineEndTouching);
	return {
		hidden: new Set<number>(),
		props: new Map<number, LineEndDividerProps>([
			[
				handles.wordIndex,
				{
					lineEndRole: "word",
					hitOffsetPx: zones.word.offsetPx,
					hitWidthPx: zones.word.widthPx,
				},
			],
			[
				handles.gapIndex,
				{
					lineEndRole: "line",
					hitOffsetPx: zones.line.offsetPx,
					hitWidthPx: zones.line.widthPx,
				},
			],
		]),
	};
}

/** Hit zone for a merged handle: wide, kept inside the line when it touches the next one. */
export function getMergedHitZone(
	lineEndTouching: boolean,
	hitWidthPx = LINE_END_WIDE_HIT_PX,
): HitZone {
	return lineEndTouching
		? { offsetPx: -hitWidthPx, widthPx: hitWidthPx }
		: { offsetPx: -hitWidthPx / 2, widthPx: hitWidthPx };
}
