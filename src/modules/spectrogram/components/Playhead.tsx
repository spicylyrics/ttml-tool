import { useStore } from "jotai";
import { type FC, memo, useLayoutEffect, useRef } from "react";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import { useScrubbing } from "$/modules/spectrogram/hooks/useScrubbing.ts";
import styles from "./AudioSpectrogram.module.css";

/** Where the playhead's left edge sits, in pixels from the song start. */
export function playheadOffset(currentTimeMs: number, zoom: number) {
	return (currentTimeMs / 1000) * zoom;
}

/**
 * Both pieces follow the playback clock every frame while a song plays. They
 * move by transform, written straight to the element: a `left` change lays the
 * page out again and a React render per frame costs more, and WebKitGTK on
 * Linux pays most for both.
 */
export const PlayheadCursor: FC<{ zoom: number }> = memo(({ zoom }) => {
	const store = useStore();
	const ref = useRef<HTMLDivElement>(null);

	useLayoutEffect(() => {
		const place = () => {
			const el = ref.current;
			if (!el) return;
			const x = playheadOffset(store.get(currentTimeAtom), zoom);
			el.style.transform = `translateX(${x}px)`;
		};
		place();
		return store.sub(currentTimeAtom, place);
	}, [store, zoom]);

	return <div ref={ref} className={styles.playheadCursor} />;
});

export const ScrubHandle: FC<{
	scrollContainerRef: React.RefObject<HTMLDivElement | null>;
	scrollLeft: number;
	zoom: number;
	containerWidth: number;
}> = memo(({ scrollContainerRef, scrollLeft, zoom, containerWidth }) => {
	const store = useStore();
	const ref = useRef<HTMLDivElement>(null);
	const { handleScrubStart } = useScrubbing(
		scrollContainerRef,
		scrollLeft,
		zoom,
	);

	useLayoutEffect(() => {
		let shown: boolean | null = null;
		const place = () => {
			const el = ref.current;
			if (!el) return;
			const x = playheadOffset(store.get(currentTimeAtom), zoom) - scrollLeft;
			const visible = x >= 0 && x <= containerWidth;
			if (visible !== shown) {
				el.style.display = visible ? "block" : "none";
				shown = visible;
			}
			// The -45% from the stylesheet centers the triangle's tip on x.
			if (visible) el.style.transform = `translateX(${x}px) translateX(-45%)`;
		};
		place();
		return store.sub(currentTimeAtom, place);
	}, [store, zoom, scrollLeft, containerWidth]);

	return (
		<div
			ref={ref}
			className={styles.playheadScrubHandle}
			onMouseDown={handleScrubStart}
		/>
	);
});
