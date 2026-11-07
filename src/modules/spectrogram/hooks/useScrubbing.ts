import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioBufferAtom, currentTimeAtom } from "$/modules/audio/states";

/**
 * Dragging the playhead or ruler scrubs the song. The time under the pointer
 * is recomputed when the pointer moves and when the view scrolls or zooms
 * under a still pointer, so wheel-scrolling mid-drag carries the playhead.
 */
export function useScrubbing(
	scrollContainerRef: React.RefObject<HTMLDivElement | null>,
	scrollLeft: number,
	zoom: number,
) {
	const audioBuffer = useAtomValue(audioBufferAtom);
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const scrubbingRef = useRef(false);
	const clientXRef = useRef(0);
	// Latest values for the window listeners, which live for the whole drag.
	const viewRef = useRef({ scrollLeft, zoom, audioBuffer, setCurrentTime });
	viewRef.current = { scrollLeft, zoom, audioBuffer, setCurrentTime };

	const update = useCallback(() => {
		const container = scrollContainerRef.current;
		const { scrollLeft, zoom, audioBuffer, setCurrentTime } = viewRef.current;
		if (!container || !audioBuffer) return;
		const rect = container.getBoundingClientRect();
		const x = Math.max(0, Math.min(clientXRef.current - rect.left, rect.width));
		const time = Math.max(
			0,
			Math.min((scrollLeft + x) / zoom, audioBuffer.duration),
		);
		audioEngine.scrubTo(time);
		setCurrentTime(time * 1000);
	}, [scrollContainerRef]);

	const handleMove = useCallback(
		(event: MouseEvent) => {
			clientXRef.current = event.clientX;
			update();
		},
		[update],
	);

	const handleEnd = useCallback(() => {
		if (!scrubbingRef.current) return;
		scrubbingRef.current = false;
		audioEngine.endScrub();
		window.removeEventListener("mousemove", handleMove);
		window.removeEventListener("mouseup", handleEnd);
	}, [handleMove]);

	// The view moved under a still pointer (wheel scroll, zoom).
	// biome-ignore lint/correctness/useExhaustiveDependencies: re-run on view changes
	useEffect(() => {
		if (scrubbingRef.current) update();
	}, [scrollLeft, zoom, update]);

	useEffect(() => handleEnd, [handleEnd]);

	const handleScrubStart = useCallback(
		(event: React.MouseEvent) => {
			if (event.button !== 0) return;
			event.preventDefault();
			scrubbingRef.current = true;
			audioEngine.beginScrub();
			handleMove(event.nativeEvent);
			window.addEventListener("mousemove", handleMove);
			window.addEventListener("mouseup", handleEnd);
		},
		[handleMove, handleEnd],
	);

	return { handleScrubStart };
}
