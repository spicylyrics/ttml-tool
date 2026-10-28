export type FollowMode = "off" | "page" | "continuous";

/** Share of the view kept to the left of the playhead after a page jump. */
export const PAGE_LEAD_IN_RATIO = 0.1;

export interface FollowScrollInput {
	mode: FollowMode;
	playheadSeconds: number;
	zoom: number;
	viewWidth: number;
	scrollLeft: number;
	durationSeconds: number;
}

/**
 * Where the spectrogram should scroll to keep the playhead in view, or null
 * when it should stay put.
 *
 * - page: jumps only once the playhead leaves the view, landing it near the
 *   left edge so the next stretch of audio is visible.
 * - continuous: keeps the playhead centered.
 *
 * Results are whole pixels, clamped to the scrollable range.
 */
export function computeFollowScrollLeft({
	mode,
	playheadSeconds,
	zoom,
	viewWidth,
	scrollLeft,
	durationSeconds,
}: FollowScrollInput): number | null {
	if (mode === "off" || zoom <= 0 || viewWidth <= 0) return null;

	const maxScrollLeft = Math.max(0, durationSeconds * zoom - viewWidth);
	const playheadPx = playheadSeconds * zoom;
	let target: number;
	if (mode === "page") {
		if (playheadPx >= scrollLeft && playheadPx < scrollLeft + viewWidth) {
			return null;
		}
		target = playheadPx - viewWidth * PAGE_LEAD_IN_RATIO;
	} else {
		target = playheadPx - viewWidth / 2;
	}

	const clamped = Math.round(Math.max(0, Math.min(target, maxScrollLeft)));
	return Math.abs(clamped - scrollLeft) < 0.5 ? null : clamped;
}
