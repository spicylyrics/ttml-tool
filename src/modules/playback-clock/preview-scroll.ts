import { prefersReducedMotion } from "$/utils/reduced-motion";

export interface PreviewScrollTarget {
	id: string;
	getNode: () => HTMLElement | null | undefined;
	/** Virtual lists can mount an offscreen row before centering it. */
	reveal?: () => void;
	/**
	 * Scroll position that centers this target, for lists that know it without
	 * a mounted node. Used instead of measuring `getNode()`.
	 */
	getTop?: (anchor: number, offset: number) => number | undefined;
	/** Not ready to follow yet; ask again next frame. Seeks still jump. */
	deferred?: boolean;
}

export function previewScrollTop(
	currentTop: number,
	relativeTop: number,
	lineHeight: number,
	viewportHeight: number,
	maxTop: number,
	anchor: number,
	offset: number,
) {
	return Math.max(
		0,
		Math.min(
			maxTop,
			currentTop +
				relativeTop +
				lineHeight / 2 -
				viewportHeight * anchor +
				offset,
		),
	);
}

/** Shared follow policy; only placement and manual-scroll grace differ by view. */
export function createPreviewScroll(
	viewport: HTMLElement,
	options: {
		getTarget: () => PreviewScrollTarget | undefined;
		anchor?: number;
		offset?: number;
		pauseMs?: number;
	},
) {
	let lastId: string | undefined;
	let pausedUntil = 0;
	let pointerDown = false;
	let resumeTimer: ReturnType<typeof setTimeout> | undefined;
	let scrollIdleTimer: ReturnType<typeof setTimeout> | undefined;
	let programmatic = false;
	let revealFrame: number | undefined;
	let pendingId: string | undefined;
	let disposed = false;
	const cancelReveal = () => {
		if (revealFrame !== undefined) cancelAnimationFrame(revealFrame);
		revealFrame = undefined;
		pendingId = undefined;
	};
	const markProgrammatic = () => {
		programmatic = true;
		clearTimeout(scrollIdleTimer);
		scrollIdleTimer = setTimeout(() => {
			programmatic = false;
		}, 100);
	};
	const jumpTo = (top: number) => {
		// scroll-behavior CSS can otherwise animate even an "auto" scroll.
		const behavior = viewport.style.scrollBehavior;
		viewport.style.scrollBehavior = "auto";
		viewport.scrollTo({ top, behavior: "auto" });
		viewport.style.scrollBehavior = behavior;
	};
	const targetTop = (target: PreviewScrollTarget) => {
		const anchor = options.anchor ?? 0.5;
		const offset = options.offset ?? 0;
		if (target.getTop) return target.getTop(anchor, offset);
		const node = target.getNode();
		if (!node) return undefined;
		const rect = node.getBoundingClientRect();
		const viewportRect = viewport.getBoundingClientRect();
		return previewScrollTop(
			viewport.scrollTop,
			rect.top - viewportRect.top,
			rect.height,
			viewport.clientHeight,
			viewport.scrollHeight - viewport.clientHeight,
			anchor,
			offset,
		);
	};
	const center = (target: PreviewScrollTarget, seeked: boolean) => {
		const top = targetTop(target);
		if (top === undefined) return false;
		markProgrammatic();
		if (seeked || prefersReducedMotion()) jumpTo(top);
		else viewport.scrollTo({ top, behavior: "smooth" });
		lastId = target.id;
		return true;
	};
	const follow = (seeked = false) => {
		if (disposed || pointerDown) return;
		if (!seeked && performance.now() < pausedUntil) return;
		const target = options.getTarget();
		if (!target) {
			lastId = undefined;
			cancelReveal();
			return;
		}
		if (!seeked && (target.id === lastId || target.id === pendingId)) return;
		if (!seeked && target.deferred) return;
		cancelReveal();
		if (center(target, seeked) || !target.reveal) return;
		pendingId = target.id;
		markProgrammatic();
		target.reveal();
		// Allow react-viewport-list to mount before measuring. These are two
		// one-shot layout frames, never another playback/scroll animation loop.
		revealFrame = requestAnimationFrame(() => {
			revealFrame = requestAnimationFrame(() => {
				revealFrame = undefined;
				pendingId = undefined;
				if (options.getTarget()?.id === target.id) center(target, seeked);
			});
		});
	};
	const pause = () => {
		cancelReveal();
		// Stop the native smooth scroll when the user takes control, just as
		// Timing Overview used to cancel its private scroll animation.
		if (programmatic) jumpTo(viewport.scrollTop);
		programmatic = false;
		clearTimeout(scrollIdleTimer);
		pausedUntil = performance.now() + (options.pauseMs ?? 750);
		clearTimeout(resumeTimer);
		resumeTimer = setTimeout(() => {
			// Retry the active target even if the song has paused in the meantime.
			lastId = undefined;
			follow();
		}, options.pauseMs ?? 750);
	};
	const onPointerDown = () => {
		pointerDown = true;
		pause();
	};
	const onPointerUp = () => {
		if (!pointerDown) return;
		pointerDown = false;
		pause();
	};
	const onScroll = () => {
		// Native smooth-scroll events keep this guard alive until scrolling
		// settles. Unsolicited scrolls (keyboard, scrollbar, accessibility)
		// get the same grace period as wheel/touch without a polling loop.
		if (programmatic) markProgrammatic();
		else pause();
	};
	const onKeyDown = (event: KeyboardEvent) => {
		if (
			[
				"ArrowUp",
				"ArrowDown",
				"PageUp",
				"PageDown",
				"Home",
				"End",
				" ",
			].includes(event.key)
		)
			pause();
	};
	viewport.addEventListener("wheel", pause, { passive: true });
	viewport.addEventListener("touchmove", pause, { passive: true });
	viewport.addEventListener("pointerdown", onPointerDown, { passive: true });
	viewport.addEventListener("scroll", onScroll, { passive: true });
	viewport.addEventListener("keydown", onKeyDown);
	window.addEventListener("pointerup", onPointerUp);
	window.addEventListener("pointercancel", onPointerUp);
	return {
		follow,
		dispose: () => {
			disposed = true;
			clearTimeout(resumeTimer);
			clearTimeout(scrollIdleTimer);
			cancelReveal();
			viewport.removeEventListener("wheel", pause);
			viewport.removeEventListener("touchmove", pause);
			viewport.removeEventListener("pointerdown", onPointerDown);
			viewport.removeEventListener("scroll", onScroll);
			viewport.removeEventListener("keydown", onKeyDown);
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		},
	};
}
