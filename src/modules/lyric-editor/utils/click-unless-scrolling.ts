/** Clicks this soon after any scroll are taken as stopping or steering it. */
const SCROLL_QUIET_MS = 300;
/** Pointer travel beyond this turns a press into a drag (e.g. middle-button scrolling). */
const MOVE_TOLERANCE_PX = 4;
/** Presses held longer than this are not clicks. */
const MAX_PRESS_MS = 600;

let lastScrollAt = Number.NEGATIVE_INFINITY;
if (typeof window !== "undefined") {
	// Capture sees scrolls of any element, including the lyric list.
	window.addEventListener(
		"scroll",
		() => {
			lastScrollAt = performance.now();
		},
		{ capture: true, passive: true },
	);
}

/**
 * Runs `action` when the press that started with `down` ends as a plain click
 * of the same button. Middle-button presses also start browser autoscroll, so a
 * press that moves, scrolls, lasts long or follows a scroll is left alone.
 * Returns a function that drops the pending click.
 */
export function runOnClickUnlessScrolling(
	down: Pick<MouseEvent, "button" | "clientX" | "clientY">,
	action: () => void,
): () => void {
	const pressedAt = performance.now();
	if (pressedAt - lastScrollAt < SCROLL_QUIET_MS) return () => {};
	const scrollBefore = lastScrollAt;
	let moved = false;

	const onMove = (event: MouseEvent) => {
		if (
			Math.hypot(event.clientX - down.clientX, event.clientY - down.clientY) >
			MOVE_TOLERANCE_PX
		)
			moved = true;
	};
	const onUp = (event: MouseEvent) => {
		if (event.button !== down.button) return;
		stop();
		if (
			!moved &&
			lastScrollAt === scrollBefore &&
			performance.now() - pressedAt <= MAX_PRESS_MS
		)
			action();
	};
	// Autoscroll can swallow the release; never leave a stale click armed.
	const timeout = setTimeout(() => stop(), MAX_PRESS_MS);
	function stop() {
		clearTimeout(timeout);
		window.removeEventListener("pointermove", onMove, true);
		window.removeEventListener("pointerup", onUp, true);
		window.removeEventListener("pointercancel", stop, true);
		window.removeEventListener("blur", stop);
	}
	window.addEventListener("pointermove", onMove, true);
	window.addEventListener("pointerup", onUp, true);
	window.addEventListener("pointercancel", stop, true);
	// The release may happen in another window and never reach this one.
	window.addEventListener("blur", stop);
	return stop;
}
