/*
 * Adapted from the Spicy Lyrics renderer (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioCoverArtAtom, currentTimeAtom } from "$/modules/audio/states";
import { playbackClock } from "$/modules/playback-clock";
import { usePreviewScroll } from "$/modules/playback-clock/use-preview-scroll";
import { previewTimingProblemsAtom } from "$/modules/preview-problems/states";
import { customBackgroundImageAtom } from "$/modules/settings/modals/customBackground";
import {
	allowConsecutiveBackgroundLinesAtom,
	customAccentColorAtom,
	liteEffectsAtom,
	useCustomAccentAtom,
} from "$/modules/settings/states";
import {
	showFpsCounterAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicyBackgroundModeAtom,
	spicyForceLineSyncedAtom,
	spicyJoinSplitWordsAtom,
	spicySimpleLyricsModeAtom,
} from "$/modules/settings/states/preview";
import { lyricLinesAtom } from "$/states/main";
import { findSpicyScrollIndex } from "./active-line";
import { createSpicyAnimator, type SpringSet } from "./createSpicyAnimator";
import { joinSplitWordsInLines, remapToJoinedWords } from "./join-split-words";
import type { Spring } from "./math";
import { createSpicyLineBuilder } from "./model";
import { useCoverPalette, useKawarpBackground } from "./useBackground";
import { useSpicyVirtualList } from "./useSpicyVirtualList";

export function useSpicyLyrics() {
	// Every line, untimed ones included: they stay in place, hollow.
	const lyrics = useAtomValue(lyricLinesAtom);
	const simple = useAtomValue(spicySimpleLyricsModeAtom);
	const forceLineSynced = useAtomValue(spicyForceLineSyncedAtom);
	const joinWords = useAtomValue(spicyJoinSplitWordsAtom);
	// Off, the lines pass through untouched, so the preview is unchanged.
	const sourceLines = useMemo(
		() =>
			joinWords ? joinSplitWordsInLines(lyrics.lyricLines) : lyrics.lyricLines,
		[joinWords, lyrics.lyricLines],
	);
	const romanized = useAtomValue(showRomanLinesAtom);
	const showTranslation = useAtomValue(showTranslationLinesAtom);
	const showFps = useAtomValue(showFpsCounterAtom);
	const chosenBackgroundMode = useAtomValue(spicyBackgroundModeAtom);
	// The animated background is an 8-pass WebGL blur every frame; lite effects
	// swap it for the cover's flat colors.
	const backgroundMode =
		useAtomValue(liteEffectsAtom) && chosenBackgroundMode === "animated"
			? "color"
			: chosenBackgroundMode;
	const embeddedCoverArt = useAtomValue(audioCoverArtAtom);
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const useAccent = useAtomValue(useCustomAccentAtom);
	const accent = useAtomValue(customAccentColorAtom);
	// Background lines nest under their lead exactly as the export writes them.
	const allowConsecutiveBackgrounds = useAtomValue(
		allowConsecutiveBackgroundLinesAtom,
	);
	const setCurrentTime = useSetAtom(currentTimeAtom);
	// Empty unless "Show timing problems" is on; then flagged words are marked.
	const timingProblems = useAtomValue(previewTimingProblemsAtom);
	// A joined word shows its parts' problems, so one on "ti" in "Beautiful" stays visible.
	const problems = useMemo(() => {
		if (timingProblems.length === 0) return undefined;
		const byWordId = new Map(
			timingProblems.map((issue) => [issue.wordId, issue.problems]),
		);
		return joinWords ? remapToJoinedWords(sourceLines, byWordId) : byWordId;
	}, [timingProblems, joinWords, sourceLines]);
	const buildLines = useMemo(createSpicyLineBuilder, []);
	const lines = useMemo(
		() =>
			buildLines(
				sourceLines,
				simple,
				romanized,
				forceLineSynced,
				allowConsecutiveBackgrounds,
				problems,
				true,
			),
		[
			buildLines,
			sourceLines,
			simple,
			romanized,
			forceLineSynced,
			allowConsecutiveBackgrounds,
			problems,
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
