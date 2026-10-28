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
import { spectrogramFollowModeAtom } from "../states/follow-playhead";
import { computeFollowScrollLeft } from "../utils/follow-playhead";

/** How long the view stays where the user left it before following again. */
export const FOLLOW_IDLE_RESUME_MS = 2500;

/**
 * Scrolls the spectrogram to keep the playhead in view.
 *
 * Following pauses while the user scrolls, zooms, drags or holds the mouse
 * on the spectrogram, and re-arms on play or after FOLLOW_IDLE_RESUME_MS
 * without input. Re-arming alone doesn't move the view; the next playhead
 * update does, so a paused song stays where the user scrolled to.
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
				suspended = false;
			}, FOLLOW_IDLE_RESUME_MS);
		};
		const suspend = () => {
			suspended = true;
			scheduleResume();
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
		// Any scroll we didn't write (wheel, zoom, the audio bar's overview)
		// is the user navigating.
		const unsubScroll = store.sub(spectrogramScrollLeftAtom, () => {
			if (store.get(spectrogramScrollLeftAtom) !== ownScrollLeft) suspend();
		});
		const unsubPlaying = store.sub(audioPlayingAtom, () => {
			if (!store.get(audioPlayingAtom)) return;
			clearTimeout(idleTimer);
			suspended = false;
			follow();
		});

		// Wheel is caught here as well because the wheel scroll animates in
		// its own frame loop; this stops following before that loop starts.
		panel?.addEventListener("wheel", suspend, { capture: true, passive: true });
		panel?.addEventListener("pointerdown", onPointerDown, { capture: true });
		window.addEventListener("pointerup", onPointerUp);
		window.addEventListener("pointercancel", onPointerUp);

		follow();

		return () => {
			clearTimeout(idleTimer);
			unsubTime();
			unsubScroll();
			unsubPlaying();
			panel?.removeEventListener("wheel", suspend, { capture: true });
			panel?.removeEventListener("pointerdown", onPointerDown, {
				capture: true,
			});
			window.removeEventListener("pointerup", onPointerUp);
			window.removeEventListener("pointercancel", onPointerUp);
		};
	}, [mode, audioBuffer, store, scrollContainerRef]);
}
