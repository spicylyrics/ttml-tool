import { ToolMode } from "$/states/main.ts";

export const AUTO_SCROLL_PAUSE_MS = 3500;

export const shouldAutoCenterSelection = (toolMode: ToolMode) =>
	toolMode === ToolMode.Sync;

export interface RenderedLinePosition {
	index: number;
	top: number;
	height: number;
}

export const findClosestLineToViewportCenter = (
	viewportCenter: number,
	lines: RenderedLinePosition[],
) => {
	let closestIndex = -1;
	let closestDistance = Number.POSITIVE_INFINITY;
	for (const line of lines) {
		const distance = Math.abs(line.top + line.height / 2 - viewportCenter);
		if (distance < closestDistance) {
			closestDistance = distance;
			closestIndex = line.index;
		}
	}
	return closestIndex;
};

export const calculateScrollDuration = (
	distance: number,
	explicitDuration?: number,
): number => {
	if (explicitDuration !== undefined) return explicitDuration;
	const absDistance = Math.abs(distance);
	return Math.round(
		Math.min(750, Math.max(280, 240 + Math.sqrt(absDistance) * 8)),
	);
};

/**
 * A scroll glide from `distance` away that starts at `startVelocity` (px/ms)
 * and comes to rest on the target. From rest it is a plain ease-in-out; a
 * glide retargeted mid-flight keeps its speed instead of stalling and
 * ramping up again.
 */
export interface ScrollGlide {
	distance: number;
	startVelocity: number;
	duration: number;
}

export const createScrollGlide = (
	distance: number,
	startVelocity: number,
	duration: number,
): ScrollGlide => {
	// Only carry speed that heads towards the target, and no more than the
	// curve can absorb without overshooting it (v * duration <= 3 * distance).
	const limit = (3 * Math.abs(distance)) / duration;
	const carried =
		Math.sign(startVelocity) === Math.sign(distance)
			? Math.sign(distance) * Math.min(Math.abs(startVelocity), limit)
			: 0;
	return { distance, startVelocity: carried, duration };
};

/** Offset from the glide's start at progress `t` (0 to 1). */
export const scrollGlideOffset = (glide: ScrollGlide, t: number): number => {
	const settle = t * t * (3 - 2 * t);
	const carry = t * (1 - t) * (1 - t);
	return glide.distance * settle + glide.startVelocity * glide.duration * carry;
};

/** Speed of the glide at progress `t`, in px/ms. */
export const scrollGlideVelocity = (glide: ScrollGlide, t: number): number => {
	const settle = 6 * t * (1 - t);
	const carry = (1 - t) * (1 - 3 * t);
	return (
		(glide.distance * settle) / glide.duration + glide.startVelocity * carry
	);
};

export interface ResolveAnchorParams {
	syncTabPosition: boolean;
	toolMode: ToolMode;
	/** The playhead and line selection are the same as when this tab was left. */
	unchangedSinceLeft: boolean;
	modeAnchor: number;
	sharedAnchor: number;
	selectedLineIds: Set<string>;
	currentTime: number;
	lines: any[];
	previousMode: ToolMode;
	syncFocusMainLine: boolean;
	findCurrentLineIndex: (
		lines: any[],
		currentTime: number,
		focusMainLine: boolean,
	) => number;
}

export const resolveAnchorLineIndex = ({
	syncTabPosition,
	unchangedSinceLeft,
	modeAnchor,
	sharedAnchor,
	selectedLineIds,
	currentTime,
	lines,
	previousMode,
	syncFocusMainLine,
	findCurrentLineIndex,
}: ResolveAnchorParams): number => {
	// Nothing was played or selected elsewhere, so go back to where this tab was.
	if (unchangedSinceLeft && modeAnchor !== -1) {
		return modeAnchor;
	}
	if (!syncTabPosition) {
		return modeAnchor;
	}

	let targetLineIndex = -1;
	if (previousMode === ToolMode.Preview && currentTime > 0) {
		targetLineIndex = findCurrentLineIndex(
			lines,
			currentTime,
			syncFocusMainLine,
		);
		if (targetLineIndex === -1) {
			const upcoming = lines.findIndex((l) => l.startTime >= currentTime);
			if (upcoming !== -1) targetLineIndex = upcoming;
		}
	} else {
		if (selectedLineIds.size > 0) {
			targetLineIndex = lines.findIndex((l) => selectedLineIds.has(l.id));
		}
		if (targetLineIndex === -1 && currentTime > 0) {
			targetLineIndex = findCurrentLineIndex(
				lines,
				currentTime,
				syncFocusMainLine,
			);
			if (targetLineIndex === -1) {
				const upcoming = lines.findIndex((l) => l.startTime >= currentTime);
				if (upcoming !== -1) targetLineIndex = upcoming;
			}
		}
	}

	if (targetLineIndex === -1) {
		targetLineIndex = sharedAnchor;
	}

	return targetLineIndex;
};
