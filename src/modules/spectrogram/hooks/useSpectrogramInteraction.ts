import { useAtom, useStore } from "jotai";
import { useAtomValue } from "jotai/index";
import { useCallback, useEffect, useRef } from "react";
import { audioBufferAtom, currentTimeAtom } from "$/modules/audio/states";
import {
	spectrogramScrollLeftAtom,
	spectrogramZoomAtom,
} from "$/modules/spectrogram/states";
import { spectrogramFollowEngagedAtom } from "../states/follow-playhead";

const clampZoom = (z: number) => Math.max(50, Math.min(z, 10000));
const initializedBuffers = new WeakMap<
	ReturnType<typeof useStore>,
	WeakSet<AudioBuffer>
>();

export function useSpectrogramInteraction(
	scrollContainerRef: React.RefObject<HTMLDivElement | null>,
	containerWidth: number,
) {
	const store = useStore();
	const audioBuffer = useAtomValue(audioBufferAtom);
	const [zoom, setZoom] = useAtom(spectrogramZoomAtom);
	const [scrollLeft, setScrollLeft] = useAtom(spectrogramScrollLeftAtom);

	const targetScrollLeftRef = useRef(scrollLeft);
	const targetZoomRef = useRef(zoom);
	const animationFrameRef = useRef<number | null>(null);
	const currentScrollLeftRef = useRef(scrollLeft);
	const currentZoomRef = useRef(zoom);
	// Where the playhead sits in the view while a zoom follows it, else null.
	const playheadAnchorRef = useRef<number | null>(null);
	const viewRef = useRef({ duration: 0, width: containerWidth });
	viewRef.current = {
		duration: audioBuffer?.duration ?? 0,
		width: containerWidth,
	};

	const animationLoop = useCallback(() => {
		const targetZoom = targetZoomRef.current;
		const currentScroll = currentScrollLeftRef.current;
		const currentZoom = currentZoomRef.current;

		const lerpFactor = 0.35;
		const nextZoom = (1 - lerpFactor) * currentZoom + lerpFactor * targetZoom;
		const zoomDiff = Math.abs(nextZoom - targetZoom);

		const anchor = playheadAnchorRef.current;
		if (anchor !== null) {
			// Zooming while following: keep the live playhead at its spot every
			// frame, so the view zooms and follows in one motion instead of
			// aiming at where the playhead was when the wheel turned.
			const done = zoomDiff < 2;
			const z = done ? targetZoom : nextZoom;
			const { duration, width } = viewRef.current;
			const maxScroll = Math.max(0, duration * z - width);
			const s = Math.max(
				0,
				Math.min((store.get(currentTimeAtom) / 1000) * z - anchor, maxScroll),
			);
			setScrollLeft(s);
			setZoom(z);
			targetScrollLeftRef.current = s;
			if (done) {
				playheadAnchorRef.current = null;
				animationFrameRef.current = null;
			} else {
				animationFrameRef.current = requestAnimationFrame(animationLoop);
			}
			return;
		}

		const targetScroll = targetScrollLeftRef.current;
		const nextScroll =
			(1 - lerpFactor) * currentScroll + lerpFactor * targetScroll;
		const scrollDiff = Math.abs(nextScroll - targetScroll);

		if (scrollDiff < 1 && zoomDiff < 2) {
			setScrollLeft(targetScroll);
			setZoom(targetZoom);
			animationFrameRef.current = null;
		} else {
			setScrollLeft(nextScroll);
			setZoom(nextZoom);
			animationFrameRef.current = requestAnimationFrame(animationLoop);
		}
	}, [setScrollLeft, setZoom, store]);

	const startAnimation = useCallback(() => {
		if (animationFrameRef.current === null) {
			animationFrameRef.current = requestAnimationFrame(animationLoop);
		}
	}, [animationLoop]);

	const handleWheelScroll = useCallback(
		(event: WheelEvent) => {
			if (!scrollContainerRef.current || !audioBuffer) {
				return;
			}
			event.preventDefault();

			const container = scrollContainerRef.current;
			const rect = container.getBoundingClientRect();
			const mouseX = event.clientX - rect.left;

			if (event.ctrlKey) {
				const currentZoom = targetZoomRef.current;
				const currentScroll = targetScrollLeftRef.current;

				// While the view follows the playhead continuously, zoom around
				// the playhead so following and zooming agree on where to scroll.
				// A zoom already following keeps its anchor: the target scroll it
				// would be measured from isn't updated while it runs.
				const following = store.get(spectrogramFollowEngagedAtom);
				const anchorX = following
					? (playheadAnchorRef.current ??
						(store.get(currentTimeAtom) / 1000) * currentZoomRef.current -
							currentScrollLeftRef.current)
					: mouseX;
				playheadAnchorRef.current = following ? anchorX : null;
				const timeAtAnchor = (currentScroll + anchorX) / currentZoom;
				const zoomFactor = event.deltaY < 0 ? 1.15 : 0.85;
				const newZoom = clampZoom(currentZoom * zoomFactor);
				if (newZoom === currentZoom) return;

				const newScrollLeft = timeAtAnchor * newZoom - anchorX;

				const totalWidth = audioBuffer.duration * newZoom;
				const maxScrollLeft = Math.max(0, totalWidth - containerWidth);
				const clampedScrollLeft = Math.max(
					0,
					Math.min(newScrollLeft, maxScrollLeft),
				);

				targetZoomRef.current = newZoom;
				targetScrollLeftRef.current = clampedScrollLeft;
			} else {
				playheadAnchorRef.current = null;
				const scrollAmount = event.deltaY + event.deltaX;
				if (scrollAmount !== 0) {
					const newScrollLeft = targetScrollLeftRef.current + scrollAmount;

					const totalWidth = audioBuffer.duration * targetZoomRef.current;
					const maxScrollLeft = Math.max(0, totalWidth - containerWidth);
					const clampedScrollLeft = Math.max(
						0,
						Math.min(newScrollLeft, maxScrollLeft),
					);

					targetScrollLeftRef.current = clampedScrollLeft;
				}
			}

			startAnimation();
		},
		[startAnimation, audioBuffer, containerWidth, scrollContainerRef, store],
	);

	useEffect(() => {
		const container = scrollContainerRef.current;
		if (!container) return;

		container.addEventListener("wheel", handleWheelScroll, { passive: false });

		return () => {
			container.removeEventListener("wheel", handleWheelScroll);
		};
	}, [handleWheelScroll, scrollContainerRef]);

	useEffect(() => {
		currentScrollLeftRef.current = scrollLeft;
		if (animationFrameRef.current === null) {
			targetScrollLeftRef.current = scrollLeft;
		}
	}, [scrollLeft]);

	useEffect(() => {
		currentZoomRef.current = zoom;
		if (animationFrameRef.current === null) {
			targetZoomRef.current = zoom;
		}
	}, [zoom]);

	useEffect(() => {
		let buffers = initializedBuffers.get(store);
		if (!buffers) {
			buffers = new WeakSet();
			initializedBuffers.set(store, buffers);
		}
		if (audioBuffer && !buffers.has(audioBuffer)) {
			buffers.add(audioBuffer);
			setScrollLeft(0);
			targetScrollLeftRef.current = 0;
			currentScrollLeftRef.current = 0;
		}
	}, [audioBuffer, setScrollLeft, store]);

	useEffect(
		() => () => {
			if (animationFrameRef.current !== null)
				cancelAnimationFrame(animationFrameRef.current);
			animationFrameRef.current = null;
		},
		[],
	);

	return {
		zoom,
		scrollLeft,
		isZooming: Math.abs(zoom - targetZoomRef.current) > 0.01,
		targetZoomRef,
	};
}
