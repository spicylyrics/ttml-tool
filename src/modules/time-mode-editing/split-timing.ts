import type { LyricWord } from "$/types/ttml";

/**
 * Moves the boundary of a two-part split to the playhead when the playhead is
 * strictly inside the original word. Otherwise the proportional split from the
 * Split word dialog is kept as is, including every split into three or more
 * parts. Inputs are never mutated.
 */
export function applyPlayheadSplit(
	original: Pick<LyricWord, "startTime" | "endTime">,
	parts: LyricWord[],
	playheadMs: number | null,
): LyricWord[] {
	if (playheadMs === null || !Number.isFinite(playheadMs)) return parts;
	if (parts.length !== 2) return parts;
	const at = Math.round(playheadMs);
	if (!(original.startTime < at && at < original.endTime)) return parts;
	return [
		{ ...parts[0], startTime: original.startTime, endTime: at },
		{ ...parts[1], startTime: at, endTime: original.endTime },
	];
}
