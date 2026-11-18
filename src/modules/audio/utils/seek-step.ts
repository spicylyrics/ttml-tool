export const DEFAULT_SEEK_STEP = 5;
export const MIN_SEEK_STEP = 0.1;
export const MAX_SEEK_STEP = 60;

/** Seconds the seek shortcuts jump, rounded to tenths and kept in range. */
export function clampSeekStep(value: number): number {
	if (!Number.isFinite(value)) return DEFAULT_SEEK_STEP;
	const rounded = Math.round(value * 10) / 10;
	return Math.min(MAX_SEEK_STEP, Math.max(MIN_SEEK_STEP, rounded));
}

/** Where one seek lands, kept inside the song. */
export function seekTarget(
	current: number,
	step: number,
	direction: 1 | -1,
	duration: number,
): number {
	return Math.min(duration, Math.max(0, current + direction * step));
}

/**
 * How often a held seek key seeks again. The OS repeats keys around 30 times a
 * second, which would cross a whole song in a couple of seconds.
 */
export const SEEK_REPEAT_INTERVAL_MS = 100;

/**
 * Lets every first press through and held-key repeats at most once per
 * interval. Shared by both seek directions so switching keys mid-hold doesn't
 * double the rate.
 */
export function createRepeatThrottle(intervalMs = SEEK_REPEAT_INTERVAL_MS) {
	let last = Number.NEGATIVE_INFINITY;
	return (evt: { repeat?: boolean; triggerTime: number }): boolean => {
		if (evt.repeat && evt.triggerTime - last < intervalMs) return false;
		last = evt.triggerTime;
		return true;
	};
}
