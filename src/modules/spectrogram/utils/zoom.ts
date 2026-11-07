/** The old fixed floor, in pixels per second. Short songs keep it. */
const DEFAULT_MIN_ZOOM = 50;

/**
 * Below this zoom, lines draw as plain bars without their words. A word is a
 * few pixels wide there, too small to read or grab, and drawing a whole song's
 * words on every zoom frame took ~30 ms. Above the old 50 px/s floor, so
 * nothing reachable before changes.
 */
export const WORD_DETAIL_MIN_ZOOM = 30;

/**
 * Lowest zoom (pixels per second): far enough out for the whole song to fit
 * the view, so far-away parts are a zoom away instead of a long scroll. Never
 * tighter than the old 50 px/s floor; zooming out past a fit just adds space.
 */
export function minZoom(durationSeconds: number, viewWidthPx: number) {
	if (durationSeconds <= 0 || viewWidthPx <= 0) return DEFAULT_MIN_ZOOM;
	return Math.min(DEFAULT_MIN_ZOOM, viewWidthPx / durationSeconds);
}

export function clampZoom(
	zoom: number,
	durationSeconds: number,
	viewWidthPx: number,
	maxZoom: number,
) {
	return Math.max(
		minZoom(durationSeconds, viewWidthPx),
		Math.min(zoom, maxZoom),
	);
}
