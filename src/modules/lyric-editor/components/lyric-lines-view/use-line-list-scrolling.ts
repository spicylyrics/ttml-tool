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
import type { ViewportListRef } from "react-viewport-list";
import { currentTimeAtom } from "$/modules/audio/states";
import {
	editTabPositionAtom,
	syncFocusMainLineAtom,
	syncTabPositionAtom,
} from "$/modules/settings/states/sync.ts";
import {
	lyricLinesAtom,
	previousToolModeAtom,
	selectedLinesAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import {
	calculateScrollDuration,
	easeInOutSine,
	findClosestLineToViewportCenter,
	resolveAnchorLineIndex,
} from "../selection-scroll";
import { findCurrentLineIndex } from "./current-line";
import {
	type EditScrollMemory,
	useEditScrollMemory,
} from "./use-edit-scroll-memory";
import type { useLineListSelection } from "./use-line-list-selection";

export function useLineListScrolling({
	viewElRef,
	viewRef,
	visibleItems,
	toolMode,
	store,
	onAnchorSettled,
}: {
	viewElRef: React.RefObject<HTMLDivElement | null>;
	viewRef: React.RefObject<ViewportListRef | null>;
	visibleItems: ReturnType<typeof useLineListSelection>["visibleItems"];
	toolMode: ToolMode;
	store: ReturnType<typeof useStore>;
	/** Called once the list sits on its restored line, or has none to restore. */
	onAnchorSettled: () => void;
}) {
	// Explicit ref dependencies preserve the original callbacks: these refs never change identity.
	const scrollRafRef = useRef<number | null>(null);
	const isProgrammaticScrollRef = useRef(false);
	const lastProgrammaticScrollTimeRef = useRef<number>(0);
	// Set below, once scrollToLineIndex exists.
	const editScrollMemoryRef = useRef<EditScrollMemory | null>(null);

	const cancelScrollAnimation = useCallback(() => {
		if (scrollRafRef.current !== null) {
			cancelAnimationFrame(scrollRafRef.current);
			scrollRafRef.current = null;
		}
		isProgrammaticScrollRef.current = false;
	}, []);

	const updateEditorAnchor = useCallback(() => {
		const viewEl = viewElRef.current;
		// A detached list measures every line at 0, which would save a junk anchor.
		if (!viewEl?.isConnected) return;
		const viewRect = viewEl.getBoundingClientRect();
		const positions = Array.from(
			viewEl.querySelectorAll<HTMLElement>("[data-lyric-line-index]"),
		).flatMap((element) => {
			const index = Number(element.dataset.lyricLineIndex);
			if (!Number.isFinite(index)) return [];
			const rect = element.getBoundingClientRect();
			return [{ index, top: rect.top, height: rect.height }];
		});
		const closest = findClosestLineToViewportCenter(
			viewRect.top + viewRect.height / 2,
			positions,
		);
		if (closest !== -1) {
			modeAnchorLines[toolMode] = closest;
			sharedAnchorLineIndex = closest;
			editScrollMemoryRef.current?.noteAnchor(closest);
		}
	}, [toolMode, viewElRef]);

	const smoothScrollTo = useCallback(
		(viewEl: HTMLElement, targetTop: number, duration?: number) => {
			cancelScrollAnimation();
			const startTop = viewEl.scrollTop;
			const distance = targetTop - startTop;
			if (Math.abs(distance) < 2) return;

			const animDuration = calculateScrollDuration(distance, duration);
			isProgrammaticScrollRef.current = true;
			lastProgrammaticScrollTimeRef.current = performance.now();
			const startTime = performance.now();

			const step = (now: number) => {
				const elapsed = now - startTime;
				const progress = Math.min(elapsed / animDuration, 1);
				lastProgrammaticScrollTimeRef.current = performance.now();
				viewEl.scrollTop = startTop + distance * easeInOutSine(progress);

				if (progress < 1) {
					scrollRafRef.current = requestAnimationFrame(step);
				} else {
					scrollRafRef.current = null;
					isProgrammaticScrollRef.current = false;
					updateEditorAnchor();
				}
			};

			scrollRafRef.current = requestAnimationFrame(step);
		},
		[cancelScrollAnimation, updateEditorAnchor],
	);

	useEffect(() => {
		return () => {
			cancelScrollAnimation();
		};
	}, [cancelScrollAnimation]);

	// The leaving view stays mounted while it fades out, so this is the last
	// moment it can still be measured.
	useEffect(
		() =>
			store.sub(toolModeAtom, () => {
				if (store.get(toolModeAtom) === toolMode) return;
				updateEditorAnchor();
				modeLeftState[toolMode] = {
					time: store.get(currentTimeAtom),
					selectedLineIds: store.get(selectedLinesAtom),
				};
			}),
		[store, toolMode, updateEditorAnchor],
	);

	const scrollToLineIndex = useCallback(
		(index: number, smooth = false) => {
			const viewEl = viewElRef.current;
			if (!viewEl) return;
			const targetEl = viewEl.querySelector<HTMLElement>(
				`[data-lyric-line-index="${index}"]`,
			);
			if (targetEl) {
				const targetRect = targetEl.getBoundingClientRect();
				const viewRect = viewEl.getBoundingClientRect();
				const targetTop = Math.max(
					0,
					viewEl.scrollTop +
						(targetRect.top - viewRect.top) -
						viewEl.clientHeight / 2 +
						targetRect.height / 2,
				);
				if (smooth) {
					smoothScrollTo(viewEl, targetTop);
				} else {
					cancelScrollAnimation();
					isProgrammaticScrollRef.current = true;
					lastProgrammaticScrollTimeRef.current = performance.now();
					viewEl.scrollTop = targetTop;
					requestAnimationFrame(() => {
						isProgrammaticScrollRef.current = false;
						updateEditorAnchor();
					});
				}
				return;
			}
			const viewContainerEl = viewEl.parentElement;
			if (!viewContainerEl) return;
			const visibleIndex = visibleItems.findIndex(
				(item) => item.sourceIndex === index,
			);
			if (visibleIndex === -1) return;
			isProgrammaticScrollRef.current = true;
			lastProgrammaticScrollTimeRef.current = performance.now();
			viewRef.current?.scrollToIndex({
				index: visibleIndex,
				offset: viewContainerEl.clientHeight / -2,
			});
			if (smooth) {
				requestAnimationFrame(() => {
					const el = viewEl.querySelector<HTMLElement>(
						`[data-lyric-line-index="${index}"]`,
					);
					if (el) {
						const elRect = el.getBoundingClientRect();
						const vRect = viewEl.getBoundingClientRect();
						const targetTop = Math.max(
							0,
							viewEl.scrollTop +
								(elRect.top - vRect.top) -
								viewEl.clientHeight / 2 +
								elRect.height / 2,
						);
						smoothScrollTo(viewEl, targetTop);
					} else {
						isProgrammaticScrollRef.current = false;
						updateEditorAnchor();
					}
				});
			} else {
				requestAnimationFrame(() => {
					isProgrammaticScrollRef.current = false;
					updateEditorAnchor();
				});
			}
		},
		[
			visibleItems,
			smoothScrollTo,
			cancelScrollAnimation,
			updateEditorAnchor,
			viewElRef,
			viewRef,
		],
	);
	editScrollMemoryRef.current = useEditScrollMemory({
		store,
		toolMode,
		scrollToLineIndex,
	});
	const syncTabPosition = useAtomValue(
		toolMode === ToolMode.Edit ? editTabPositionAtom : syncTabPositionAtom,
	);

	const visibleItemsRef = useRef(visibleItems);
	visibleItemsRef.current = visibleItems;
	const hasRestoredAnchorRef = useRef(false);

	const restoreEditorAnchorOnListReady = useCallback(
		(instance: ViewportListRef | null) => {
			viewRef.current = instance;
			if (!instance || hasRestoredAnchorRef.current) return;

			const leftState = modeLeftState[toolMode];
			const resolvedLineIndex = resolveAnchorLineIndex({
				syncTabPosition,
				toolMode,
				unchangedSinceLeft:
					leftState !== null &&
					leftState.time === store.get(currentTimeAtom) &&
					leftState.selectedLineIds === store.get(selectedLinesAtom),
				modeAnchor: modeAnchorLines[toolMode],
				sharedAnchor: sharedAnchorLineIndex,
				selectedLineIds: store.get(selectedLinesAtom),
				currentTime: store.get(currentTimeAtom),
				lines: store.get(lyricLinesAtom).lyricLines,
				previousMode: store.get(previousToolModeAtom) ?? ToolMode.Edit,
				syncFocusMainLine: store.get(syncFocusMainLineAtom),
				findCurrentLineIndex,
			});
			// A project reopened with scroll memory on goes back to its saved spot.
			const remembered = editScrollMemoryRef.current?.claimRestore() ?? -1;
			const targetLineIndex =
				remembered !== -1 ? remembered : resolvedLineIndex;

			if (targetLineIndex === -1) {
				hasRestoredAnchorRef.current = true;
				onAnchorSettled();
				return;
			}

			const visibleIndex = visibleItemsRef.current.findIndex(
				(item) => item.sourceIndex === targetLineIndex,
			);
			if (visibleIndex === -1) return;

			hasRestoredAnchorRef.current = true;

			requestAnimationFrame(() => {
				const viewEl = viewElRef.current;
				if (!viewEl?.parentElement) return;
				const offset = viewEl.parentElement.clientHeight / -2;
				instance.scrollToIndex({ index: visibleIndex, offset });
				const centerTarget = () => {
					const el = viewEl.querySelector<HTMLElement>(
						`[data-lyric-line-index="${targetLineIndex}"]`,
					);
					if (!el) return false;
					const elRect = el.getBoundingClientRect();
					const vRect = viewEl.getBoundingClientRect();
					const targetTop = Math.max(
						0,
						viewEl.scrollTop +
							(elRect.top - vRect.top) -
							viewEl.clientHeight / 2 +
							elRect.height / 2,
					);
					viewEl.scrollTop = targetTop;
					return true;
				};
				requestAnimationFrame(() => {
					requestAnimationFrame(() => {
						if (centerTarget()) {
							onAnchorSettled();
						} else {
							setTimeout(() => {
								centerTarget();
								onAnchorSettled();
							}, 50);
						}
					});
				});
				if (sharedAnchorLineIndex === targetLineIndex) {
					sharedAnchorLineIndex = -1;
				}
			});
		},
		[syncTabPosition, store, toolMode, viewElRef, viewRef, onAnchorSettled],
	);

	return {
		scrollRafRef,
		isProgrammaticScrollRef,
		lastProgrammaticScrollTimeRef,
		cancelScrollAnimation,
		updateEditorAnchor,
		scrollToLineIndex,
		restoreEditorAnchorOnListReady,
	};
}

const modeAnchorLines: Record<ToolMode, number> = {
	[ToolMode.Edit]: -1,
	[ToolMode.Sync]: -1,
	[ToolMode.Preview]: -1,
};
let sharedAnchorLineIndex = -1;
const modeLeftState: Record<
	ToolMode,
	{ time: number; selectedLineIds: Set<string> } | null
> = {
	[ToolMode.Edit]: null,
	[ToolMode.Sync]: null,
	[ToolMode.Preview]: null,
};
