/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/spicylyrics/ttml-tool/blob/main/LICENSE
 */

import { useAtomValue, type useStore } from "jotai";
import { useCallback, useEffect, useRef } from "react";
import { audioPlayingAtom, currentTimeAtom } from "$/modules/audio/states";
import {
	editAutoScrollAtom,
	syncAutoScrollAtom,
	syncFocusMainLineAtom,
} from "$/modules/settings/states/sync.ts";
import { keyLocateActiveLineAtom } from "$/states/keybindings.ts";
import { lyricLinesAtom, selectedLinesAtom, ToolMode } from "$/states/main.ts";
import { useKeyBindingAtom } from "$/utils/keybindings.ts";
import styles from "../index.module.css";
import { AUTO_SCROLL_PAUSE_MS } from "../selection-scroll";
import { findCurrentLineIndex } from "./current-line";
import type { useLineListScrolling } from "./use-line-list-scrolling";

export function useLineListAutoScroll({
	viewElRef,
	toolMode,
	store,
	scrollToIndex,
	lastSelectionScrolledIndexRef,
	lastPlaybackScrolledIndexRef,
	scrollRafRef,
	isProgrammaticScrollRef,
	lastProgrammaticScrollTimeRef,
	cancelScrollAnimation,
	updateEditorAnchor,
	scrollToLineIndex,
}: {
	viewElRef: React.RefObject<HTMLDivElement | null>;
	toolMode: ToolMode;
	store: ReturnType<typeof useStore>;
	scrollToIndex: number | undefined;
	lastSelectionScrolledIndexRef: React.RefObject<number | undefined>;
	lastPlaybackScrolledIndexRef: React.RefObject<number | undefined>;
	scrollRafRef: ReturnType<typeof useLineListScrolling>["scrollRafRef"];
	isProgrammaticScrollRef: ReturnType<
		typeof useLineListScrolling
	>["isProgrammaticScrollRef"];
	lastProgrammaticScrollTimeRef: ReturnType<
		typeof useLineListScrolling
	>["lastProgrammaticScrollTimeRef"];
	cancelScrollAnimation: ReturnType<
		typeof useLineListScrolling
	>["cancelScrollAnimation"];
	updateEditorAnchor: ReturnType<
		typeof useLineListScrolling
	>["updateEditorAnchor"];
	scrollToLineIndex: ReturnType<
		typeof useLineListScrolling
	>["scrollToLineIndex"];
}) {
	// Passed refs have the same stable identity as the original component-local refs.
	const syncAutoScroll = useAtomValue(
		toolMode === ToolMode.Edit ? editAutoScrollAtom : syncAutoScrollAtom,
	);
	const syncFocusMainLine = useAtomValue(syncFocusMainLineAtom);
	const userScrolledAtRef = useRef<number>(0);
	const lastKnownTimeRef = useRef(0);
	const resumeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	const isPointerDownRef = useRef(false);

	const isAutoScrollActive =
		(toolMode === ToolMode.Sync || toolMode === ToolMode.Edit) &&
		syncAutoScroll;

	const cancelResumeTimer = useCallback(() => {
		if (resumeTimerRef.current !== null) {
			clearTimeout(resumeTimerRef.current);
			resumeTimerRef.current = null;
		}
	}, []);

	const scheduleResume = useCallback(
		(durationMs = AUTO_SCROLL_PAUSE_MS) => {
			cancelResumeTimer();
			if (!isAutoScrollActive) return;
			if (store.get(selectedLinesAtom).size > 0) return;
			if (isPointerDownRef.current) return;

			resumeTimerRef.current = setTimeout(() => {
				resumeTimerRef.current = null;
				if (!store.get(audioPlayingAtom)) return;
				if (store.get(selectedLinesAtom).size > 0) return;
				if (isPointerDownRef.current) return;

				const currentTime = store.get(currentTimeAtom);
				const lines = store.get(lyricLinesAtom).lyricLines;
				const index = findCurrentLineIndex(
					lines,
					currentTime,
					syncFocusMainLine,
				);
				if (index !== -1) {
					lastPlaybackScrolledIndexRef.current = index;
					scrollToLineIndex(index, true);
				}
			}, durationMs);
		},
		[
			cancelResumeTimer,
			isAutoScrollActive,
			store,
			syncFocusMainLine,
			scrollToLineIndex,
			lastPlaybackScrolledIndexRef,
		],
	);

	useEffect(() => {
		if (scrollToIndex === undefined || Number.isNaN(scrollToIndex)) {
			lastSelectionScrolledIndexRef.current = undefined;
			return;
		}
		if (scrollToIndex === lastSelectionScrolledIndexRef.current) return;
		lastSelectionScrolledIndexRef.current = scrollToIndex;
		cancelResumeTimer();
		userScrolledAtRef.current = Date.now();
		// Retargets any glide in flight, keeping its speed.
		scrollToLineIndex(scrollToIndex, true);
	}, [
		scrollToIndex,
		scrollToLineIndex,
		cancelResumeTimer,
		lastSelectionScrolledIndexRef,
	]);

	const handleScroll = useCallback(() => {
		if (scrollRafRef.current !== null || isProgrammaticScrollRef.current) {
			return;
		}
		updateEditorAnchor();
		if (!isAutoScrollActive) return;
		if (performance.now() - lastProgrammaticScrollTimeRef.current < 100) {
			return;
		}
		cancelScrollAnimation();
		userScrolledAtRef.current = Date.now();
		if (!isPointerDownRef.current && store.get(selectedLinesAtom).size === 0) {
			scheduleResume(AUTO_SCROLL_PAUSE_MS);
		}
	}, [
		updateEditorAnchor,
		isAutoScrollActive,
		cancelScrollAnimation,
		scheduleResume,
		store,
		scrollRafRef,
		isProgrammaticScrollRef,
		lastProgrammaticScrollTimeRef,
	]);

	useEffect(() => {
		const viewEl = viewElRef.current;
		if (!viewEl) return;
		viewEl.addEventListener("scroll", handleScroll, { passive: true });
		return () => {
			updateEditorAnchor();
			viewEl.removeEventListener("scroll", handleScroll);
		};
	}, [handleScroll, updateEditorAnchor, viewElRef]);

	const handleLocate = useCallback(() => {
		cancelResumeTimer();
		if (store.get(selectedLinesAtom).size > 0) {
			store.set(selectedLinesAtom, new Set());
		}
		userScrolledAtRef.current = 0;
		const currentTime = store.get(currentTimeAtom);
		const lyricLines = store.get(lyricLinesAtom).lyricLines;
		const index = findCurrentLineIndex(
			lyricLines,
			currentTime,
			syncFocusMainLine,
		);
		if (index !== -1) {
			lastPlaybackScrolledIndexRef.current = index;
			scrollToLineIndex(index, true);
		}
	}, [
		store,
		syncFocusMainLine,
		scrollToLineIndex,
		cancelResumeTimer,
		lastPlaybackScrolledIndexRef,
	]);

	useKeyBindingAtom(keyLocateActiveLineAtom, handleLocate, [handleLocate]);

	// Track pointer hold state, wheel, touch, and keyboard interactions
	useEffect(() => {
		if (!isAutoScrollActive) return;
		const viewEl = viewElRef.current;
		if (!viewEl) return;

		const onPointerDown = (evt: Event) => {
			if (
				(evt.target as HTMLElement | null)?.closest(`.${styles.locateButton}`)
			)
				return;
			isPointerDownRef.current = true;
			cancelScrollAnimation();
			cancelResumeTimer();
			userScrolledAtRef.current = Date.now();
		};

		const onPointerUp = () => {
			if (!isPointerDownRef.current) return;
			isPointerDownRef.current = false;
			userScrolledAtRef.current = Date.now();
			if (store.get(selectedLinesAtom).size === 0) {
				scheduleResume(AUTO_SCROLL_PAUSE_MS);
			}
		};

		const onWheel = () => {
			cancelScrollAnimation();
			userScrolledAtRef.current = Date.now();
			if (store.get(selectedLinesAtom).size === 0) {
				scheduleResume(AUTO_SCROLL_PAUSE_MS);
			}
		};

		const onKeyDown = (evt: KeyboardEvent) => {
			if (evt.ctrlKey || evt.altKey || evt.metaKey) return;
			if (["Control", "Shift", "Alt", "Meta"].includes(evt.key)) return;
			userScrolledAtRef.current = Date.now();
			if (store.get(selectedLinesAtom).size === 0) {
				scheduleResume(AUTO_SCROLL_PAUSE_MS);
			}
		};

		viewEl.addEventListener("pointerdown", onPointerDown, {
			capture: true,
			passive: true,
		});
		window.addEventListener("pointerup", onPointerUp, {
			capture: true,
			passive: true,
		});
		window.addEventListener("pointercancel", onPointerUp, {
			capture: true,
			passive: true,
		});
		viewEl.addEventListener("touchmove", onPointerDown, {
			capture: true,
			passive: true,
		});
		viewEl.addEventListener("wheel", onWheel, { capture: true, passive: true });
		viewEl.addEventListener("keydown", onKeyDown, {
			capture: true,
			passive: true,
		});

		return () => {
			viewEl.removeEventListener("pointerdown", onPointerDown, {
				capture: true,
			});
			window.removeEventListener("pointerup", onPointerUp, { capture: true });
			window.removeEventListener("pointercancel", onPointerUp, {
				capture: true,
			});
			viewEl.removeEventListener("touchmove", onPointerDown, { capture: true });
			viewEl.removeEventListener("wheel", onWheel, { capture: true });
			viewEl.removeEventListener("keydown", onKeyDown, { capture: true });
			cancelResumeTimer();
		};
	}, [
		isAutoScrollActive,
		scheduleResume,
		cancelResumeTimer,
		cancelScrollAnimation,
		store,
		viewElRef,
	]);

	// When a line is selected, cancel auto-scroll resume so it stays locked forever
	useEffect(() => {
		if (!isAutoScrollActive) return;
		return store.sub(selectedLinesAtom, () => {
			const selected = store.get(selectedLinesAtom);
			if (selected.size > 0) {
				cancelResumeTimer();
				cancelScrollAnimation();
				userScrolledAtRef.current = Date.now();
			}
		});
	}, [isAutoScrollActive, store, cancelResumeTimer, cancelScrollAnimation]);

	useEffect(() => {
		if (!isAutoScrollActive) return;
		return store.sub(currentTimeAtom, () => {
			const currentTime = store.get(currentTimeAtom);
			if (
				Math.abs(currentTime - lastKnownTimeRef.current) > AUTO_SCROLL_PAUSE_MS
			) {
				if (
					Date.now() - userScrolledAtRef.current > 500 &&
					!isPointerDownRef.current &&
					store.get(selectedLinesAtom).size === 0
				) {
					userScrolledAtRef.current = 0;
					cancelResumeTimer();
				}
			}
			lastKnownTimeRef.current = currentTime;

			// Skip if playback is paused
			if (!store.get(audioPlayingAtom)) return;
			// Skip if pointer is currently held down (user dragging or holding scrollbar)
			if (isPointerDownRef.current) return;
			// Skip if any line is selected (stays locked forever until deselected or locate triggered)
			if (store.get(selectedLinesAtom).size > 0) return;
			// Skip if user interacted/scrolled within last 3.5s
			if (Date.now() - userScrolledAtRef.current < AUTO_SCROLL_PAUSE_MS) return;
			// Skip if an input or textarea is focused
			const activeTag = document.activeElement?.tagName;
			if (activeTag === "INPUT" || activeTag === "TEXTAREA") return;

			const lines = store.get(lyricLinesAtom).lyricLines;
			const index = findCurrentLineIndex(lines, currentTime, syncFocusMainLine);
			if (index !== -1 && index !== lastPlaybackScrolledIndexRef.current) {
				lastPlaybackScrolledIndexRef.current = index;
				scrollToLineIndex(index, true);
			}
		});
	}, [
		store,
		isAutoScrollActive,
		syncFocusMainLine,
		scrollToLineIndex,
		cancelResumeTimer,
		lastPlaybackScrolledIndexRef,
	]);

	return { handleLocate };
}
