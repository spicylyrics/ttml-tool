/*
 * Adapted from the Spicy Lyrics renderer (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { timedPreviewLyricsAtom } from "$/components/PreviewModeSwitcher/states";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioCoverArtAtom, currentTimeAtom } from "$/modules/audio/states";
import { playbackClock } from "$/modules/playback-clock";
import { usePreviewScroll } from "$/modules/playback-clock/use-preview-scroll";
import { customBackgroundImageAtom } from "$/modules/settings/modals/customBackground";
import {
	allowConsecutiveBackgroundLinesAtom,
	customAccentColorAtom,
	useCustomAccentAtom,
} from "$/modules/settings/states";
import {
	showFpsCounterAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicyBackgroundModeAtom,
	spicyForceLineSyncedAtom,
	spicySimpleLyricsModeAtom,
} from "$/modules/settings/states/preview";
import { findSpicyScrollIndex } from "./active-line";
import { createSpicyAnimator, type SpringSet } from "./createSpicyAnimator";
import type { Spring } from "./math";
import { buildSpicyLines } from "./model";
import { useCoverPalette, useKawarpBackground } from "./useBackground";
import { useSpicyVirtualList } from "./useSpicyVirtualList";

export function useSpicyLyrics() {
	const lyrics = useAtomValue(timedPreviewLyricsAtom);
	const simple = useAtomValue(spicySimpleLyricsModeAtom);
	const forceLineSynced = useAtomValue(spicyForceLineSyncedAtom);
	const romanized = useAtomValue(showRomanLinesAtom);
	const showTranslation = useAtomValue(showTranslationLinesAtom);
	const showFps = useAtomValue(showFpsCounterAtom);
	const backgroundMode = useAtomValue(spicyBackgroundModeAtom);
	const embeddedCoverArt = useAtomValue(audioCoverArtAtom);
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const useAccent = useAtomValue(useCustomAccentAtom);
	const accent = useAtomValue(customAccentColorAtom);
	// Background lines nest under their lead exactly as the export writes them.
	const allowConsecutiveBackgrounds = useAtomValue(
		allowConsecutiveBackgroundLinesAtom,
	);
	const setCurrentTime = useSetAtom(currentTimeAtom);
	const lines = useMemo(
		() =>
			buildSpicyLines(
				lyrics.lyricLines,
				simple,
				romanized,
				forceLineSynced,
				allowConsecutiveBackgrounds,
			),
		[
			lyrics.lyricLines,
			simple,
			romanized,
			forceLineSynced,
			allowConsecutiveBackgrounds,
		],
	);
	const hasDuetLines = useMemo(
		() => lines.some((line) => !line.isDotLine && line.isDuet),
		[lines],
	);
	// Match Spicy's priority: artwork embedded in the loaded audio file comes first.
	// TTML cover_art and the app-level custom image are only fallbacks.
	const coverArtImage = useMemo(
		() =>
			lyrics.metadata
				.find((entry) => entry.key.toLowerCase() === "cover_art")
				?.value.find((value) => value.trim().length > 0) ?? null,
		[lyrics.metadata],
	);
	const backgroundImage =
		embeddedCoverArt ?? coverArtImage ?? customBackgroundImage;
	const coverPalette = useCoverPalette(backgroundImage);
	const viewportRef = useRef<HTMLDivElement>(null);
	const backgroundRef = useRef<HTMLDivElement>(null);
	const lineNodes = useRef(new Map<string, HTMLDivElement>());
	const wordNodes = useRef(new Map<string, HTMLElement>());
	const springs = useRef(new Map<string, SpringSet>());
	const lineGlowSprings = useRef(new Map<string, Spring>());
	const lastTime = useRef(performance.now());
	const [fps, setFps] = useState(0);
	const fpsRef = useRef({ frames: 0, lastTime: performance.now() });
	const showFpsRef = useRef(showFps);
	useKawarpBackground(backgroundRef, backgroundImage, backgroundMode);

	useEffect(() => {
		showFpsRef.current = showFps;
		fpsRef.current = { frames: 0, lastTime: performance.now() };
		setFps(0);
	}, [showFps]);

	const animator = useRef<ReturnType<typeof createSpicyAnimator>>(null);
	const { rows, totalSize, measureRow, getTop } = useSpicyVirtualList(
		lines,
		viewportRef,
		() => animator.current?.(playbackClock.getSnapshot(), performance.now()),
	);

	// Leaving a "•••" interlude, Spicy waits for it to collapse before
	// scrolling to the next line, so the two don't read as one jerk.
	const interludeWait = useRef<{ id: string; until: number }>(null);
	const getScrollTarget = useCallback(
		(timeMs: number) => {
			const index = findSpicyScrollIndex(lines, timeMs);
			if (index < 0) return undefined;
			const line = lines[index];
			let deferred = false;
			if (lines[index - 1]?.isDotLine) {
				const now = performance.now();
				if (interludeWait.current?.id !== line.id)
					interludeWait.current = { id: line.id, until: now + 240 };
				deferred = now < interludeWait.current.until;
			} else interludeWait.current = null;
			return {
				id: line.id,
				getNode: () => lineNodes.current.get(line.id),
				getTop: (anchor: number, offset: number) =>
					getTop(index, anchor, offset),
				deferred,
			};
		},
		[lines, getTop],
	);
	usePreviewScroll(viewportRef, getScrollTarget, { offset: 30 });

	useEffect(() => {
		lastTime.current = performance.now();
		const animate = createSpicyAnimator({
			lines,
			simple,
			lineNodes,
			wordNodes,
			springs,
			lineGlowSprings,
			lastTime,
			setFps,
			fpsRef,
			showFpsRef,
		});
		animator.current = animate;
		animate(playbackClock.getSnapshot(), performance.now(), true);
		const unsubscribe = playbackClock.subscribe(animate);
		return () => {
			unsubscribe();
			animator.current = null;
		};
	}, [lines, simple]);

	const seek = useCallback(
		(time: number) => {
			setCurrentTime(time);
			audioEngine.seekMusic(time / 1000);
		},
		[setCurrentTime],
	);
	return {
		simple,
		useAccent,
		accent,
		coverPalette,
		backgroundRef,
		backgroundMode,
		backgroundImage,
		showFps,
		fps,
		viewportRef,
		hasDuetLines,
		lines,
		rows,
		totalSize,
		measureRow,
		lineNodes,
		wordNodes,
		showTranslation,
		seek,
	};
}
