import { useAtomValue, useStore } from "jotai";
import { useEffect } from "react";
import {
	audioBufferAtom,
	audioPlayingAtom,
	currentTimeAtom,
} from "$/modules/audio/states";
import {
	spectrogramContainerWidthAtom,
	spectrogramScrollLeftAtom,
	spectrogramZoomAtom,
} from "$/modules/spectrogram/states";
import {
	spectrogramFollowEngagedAtom,
	spectrogramFollowModeAtom,
} from "../states/follow-playhead";
import { computeFollowScrollLeft } from "../utils/follow-playhead";

/** How long the view stays where the user left it before following again. */
export const FOLLOW_IDLE_RESUME_MS = 2500;

/** How long the zoom animation's scroll writes count as zooming, after the last Ctrl+wheel. */
const ZOOM_SCROLL_GRACE_MS = 500;

/**
 * Scrolls the spectrogram to keep the playhead in view.
 *
 * Following pauses while the user scrolls, drags or holds the mouse on the
 * spectrogram, and re-arms on play or after FOLLOW_IDLE_RESUME_MS without
 * input. Re-arming alone doesn't move the view; the next playhead update
 * does, so a paused song stays where the user scrolled to.
 *
 * Zooming pauses page mode too. In continuous mode it keeps following: the
 * zoom anchors on the playhead instead of the cursor (see
 * spectrogramFollowEngagedAtom), so the two never fight over the scroll.
 *
 * Works through store subscriptions so it adds no React renders of its own.
 */
export function useFollowPlayhead(
	scrollContainerRef: React.RefObject<HTMLDivElement | null>,
) {
	const store = useStore();
	const mode = useAtomValue(spectrogramFollowModeAtom);
	const audioBuffer = useAtomValue(audioBufferAtom);

	useEffect(() => {
		if (mode === "off" || !audioBuffer) return;

		// The scroll container's parent also holds the ruler and the scrub
		// handle, which seek with the mouse and must pause following too.
		const container = scrollContainerRef.current;
		const panel = container?.parentElement ?? container;

		let suspended = false;
		let pointerHeld = false;
		let idleTimer: ReturnType<typeof setTimeout> | undefined;
		let ownScrollLeft: number | null = null;
		let zoomingUntil = 0;

		const setSuspended = (value: boolean) => {
			suspended = value;
			store.set(
				spectrogramFollowEngagedAtom,
				mode === "continuous" && !suspended,
			);
		};
		setSuspended(false);

		const follow = () => {
			if (suspended) return;
			const target = computeFollowScrollLeft({
				mode,
				playheadSeconds: store.get(currentTimeAtom) / 1000,
				zoom: store.get(spectrogramZoomAtom),
				viewWidth: store.get(spectrogramContainerWidthAtom),
				scrollLeft: store.get(spectrogramScrollLeftAtom),
				durationSeconds: audioBuffer.duration,
			});
			if (target === null) return;
			ownScrollLeft = target;
			store.set(spectrogramScrollLeftAtom, target);
		};

		const scheduleResume = () => {
			clearTimeout(idleTimer);
			if (pointerHeld) return;
			idleTimer = setTimeout(() => {
				setSuspended(false);
			}, FOLLOW_IDLE_RESUME_MS);
		};
		const suspend = () => {
			setSuspended(true);
			scheduleResume();
		};
		const onWheel = (e: WheelEvent) => {
			if (e.ctrlKey && mode === "continuous" && !suspended) {
				zoomingUntil = performance.now() + ZOOM_SCROLL_GRACE_MS;
				return;
			}
			suspend();
		};
		const onPointerDown = () => {
			pointerHeld = true;
			suspend();
		};
		const onPointerUp = () => {
			if (!pointerHeld) return;
			pointerHeld = false;
			scheduleResume();
		};

		const unsubTime = store.sub(currentTimeAtom, follow);
		// Any scroll we didn't write (wheel, the audio bar's overview) is the
		// user navigating, except the zoom animation's while following zooms.
		const unsubScroll = store.sub(spectrogramScrollLeftAtom, () => {
			if (performance.now() < zoomingUntil) return;
			if (store.get(spectrogramScrollLeftAtom) !== ownScrollLeft) suspend();
		});
		const unsubPlaying = store.sub(audioPlayingAtom, () => {
			if (!store.get(audioPlayingAtom)) return;
			clearTimeout(idleTimer);
			setSuspended(false);
			follow();
		});

		// Wheel is caught here as well because the wheel scroll animates in
		// its own frame loop; this decides before that loop starts.
		panel?.addEventListener("wheel", onWheel, { capture: true, passive: true });
		panel?.addEventListener("pointerdown", onPointerDown, { capture: true });
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);

		follow();

		return () => {
			clearTimeout(idleTimer);
			store.set(spectrogramFollowEngagedAtom, false);
			unsubTime();
			unsubScroll();
			unsubPlaying();
			panel?.removeEventListener("wheel", onWheel, { capture: true });
			panel?.removeEventListener("pointerdown", onPointerDown, {
				capture: true,
			});
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		};
	}, [mode, audioBuffer, store, scrollContainerRef]);
}
