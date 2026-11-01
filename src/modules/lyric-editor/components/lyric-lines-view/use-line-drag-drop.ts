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

import type { Draft } from "immer";
import type { Atom, useStore } from "jotai";
import { useEffect } from "react";
import { lyricLinesAtom, selectedLinesAtom, ToolMode } from "$/states/main.ts";
import type { LyricLine, TTMLLyric } from "$/types/ttml.ts";
import {
	moveSectionTo,
	type SectionDropSlot,
	sectionDropSlot,
} from "../../utils/section-editing.ts";
import {
	insertLinesInSection,
	sectionIdAt,
} from "../../utils/section-system.ts";
import {
	clampScrollTop,
	DRAG_SCROLL_SPEED,
	getDragScrollDirection,
	normalizeWheelDelta,
} from "../drag-scroll";
import styles from "../index.module.css";
import {
	draggingIdAtom,
	lastLineDragEndAtom,
	lineDragAtom,
} from "../lyric-line-view-states";

export function useLineDragDrop({
	viewElRef,
	editLyric,
	toolMode,
	store,
	editLyricLines,
}: {
	viewElRef: React.RefObject<HTMLDivElement | null>;
	editLyric: readonly Atom<LyricLine>[];
	toolMode: ToolMode;
	store: ReturnType<typeof useStore>;
	editLyricLines: (edit: (draft: Draft<TTMLLyric>) => void) => void;
}) {
	// Refs came from this component before extraction; their identities stay stable.
	useEffect(() => {
		const viewEl = viewElRef.current;
		if (editLyric.length === 0 || !viewEl || toolMode !== ToolMode.Edit) return;

		let pointer: { x: number; y: number } | null = null;
		let animationFrame: number | null = null;
		let lastFrameTime: number | null = null;
		let dropTarget: { element: HTMLElement; insertAfter: boolean } | null =
			null;
		// Where a dragged section lands, snapped to a section boundary.
		let sectionSlot: SectionDropSlot | undefined;
		let dragPreview: HTMLElement | null = null;

		const updateDragPreview = () => {
			if (!dragPreview || !pointer) return;
			dragPreview.style.transform = `translate(${pointer.x + 16}px, ${pointer.y + 16}px)`;
		};

		const clearDragPreview = () => {
			dragPreview?.remove();
			dragPreview = null;
		};

		const showDragPreview = (dragId: string) => {
			const lines = store.get(lyricLinesAtom).lyricLines;
			const lineIndex = lines.findIndex((candidate) => candidate.id === dragId);
			const line = lines[lineIndex];
			if (!line || lineIndex < 0) return;
			dragPreview = document.createElement("div");
			dragPreview.className = styles.dragPreview;
			dragPreview.setAttribute("aria-hidden", "true");
			const lineNumber = document.createElement("span");
			lineNumber.className = styles.dragPreviewNumber;
			lineNumber.textContent = String(
				lines
					.slice(0, lineIndex + 1)
					.filter((candidate, index) => (index === 0 ? true : !candidate.isBG))
					.length,
			);
			const lyricText = document.createElement("span");
			lyricText.className = styles.dragPreviewText;
			const section = store.get(lineDragAtom)?.sectionId
				? store
						.get(lyricLinesAtom)
						.sections?.find((item) => item.id === line.sectionId)
				: undefined;
			lyricText.textContent =
				section?.label ?? (line.words.map((word) => word.word).join("") || "…");
			dragPreview.append(lineNumber, lyricText);
			const selectedCount = store.get(selectedLinesAtom).size;
			if (selectedCount > 1) {
				dragPreview.dataset.lineCount = String(selectedCount);
			}
			// Mount inside the Radix theme root so the count badge gets its tokens.
			(viewEl.closest(".radix-themes") ?? document.body).append(dragPreview);
			updateDragPreview();
		};

		const clearDropTarget = () => {
			sectionSlot = undefined;
			if (!dropTarget) return;
			dropTarget.element.classList.remove(styles.dropTop, styles.dropBottom);
			dropTarget = null;
		};

		const stopScrolling = () => {
			pointer = null;
			lastFrameTime = null;
			if (animationFrame !== null) {
				cancelAnimationFrame(animationFrame);
				animationFrame = null;
			}
		};

		const updateDropTarget = () => {
			const drag = store.get(lineDragAtom);
			if (!drag?.isDragging || !pointer) {
				clearDropTarget();
				return;
			}
			let element = document
				.elementFromPoint(pointer.x, pointer.y)
				?.closest<HTMLElement>("[data-lyric-line-id]");
			const selectedLines = store.get(selectedLinesAtom);
			if (
				!element ||
				element.dataset.lyricLineId === drag.id ||
				selectedLines.has(element.dataset.lyricLineId ?? "")
			) {
				clearDropTarget();
				return;
			}
			let insertAfter =
				pointer.y >=
				element.getBoundingClientRect().top + element.clientHeight / 2;
			if (drag.sectionId) {
				const slot = sectionDropSlot(
					store.get(lyricLinesAtom).lyricLines,
					drag.sectionId,
					element.dataset.lyricLineId ?? "",
					insertAfter,
				);
				if (!slot) {
					clearDropTarget();
					return;
				}
				// The boundary line may be scrolled out or collapsed; the drop
				// still lands on the slot, only the marker stays where you point.
				const slotElement = viewEl.querySelector<HTMLElement>(
					`[data-lyric-line-id="${slot.lineId}"]`,
				);
				if (slotElement) {
					element = slotElement;
					insertAfter = slot.insertAfter;
				}
				if (
					dropTarget?.element === element &&
					dropTarget.insertAfter === insertAfter
				) {
					sectionSlot = slot;
					return;
				}
				clearDropTarget();
				sectionSlot = slot;
				element.classList.toggle(styles.dropTop, !insertAfter);
				element.classList.toggle(styles.dropBottom, insertAfter);
				dropTarget = { element, insertAfter };
				return;
			}
			if (
				dropTarget?.element === element &&
				dropTarget.insertAfter === insertAfter
			)
				return;
			clearDropTarget();
			element.classList.toggle(styles.dropTop, !insertAfter);
			element.classList.toggle(styles.dropBottom, insertAfter);
			dropTarget = { element, insertAfter };
		};

		const scrollWhileDragging = (timestamp: number) => {
			animationFrame = null;
			const drag = store.get(lineDragAtom);
			if (!drag?.isDragging || !pointer) return;

			const direction = getDragScrollDirection(
				pointer.y,
				viewEl.getBoundingClientRect(),
			);
			if (direction !== 0 && lastFrameTime !== null) {
				const elapsedSeconds = (timestamp - lastFrameTime) / 1000;
				const maxScrollTop = viewEl.scrollHeight - viewEl.clientHeight;
				viewEl.scrollTop = clampScrollTop(
					viewEl.scrollTop,
					direction * DRAG_SCROLL_SPEED * elapsedSeconds,
					maxScrollTop,
				);
			}

			lastFrameTime = timestamp;
			updateDropTarget();
			if (direction !== 0) {
				animationFrame = requestAnimationFrame(scrollWhileDragging);
			}
		};

		const ensureScrolling = () => {
			if (animationFrame !== null) return;
			animationFrame = requestAnimationFrame(scrollWhileDragging);
		};

		const startPointerDrag = (event: PointerEvent) => {
			if (!event.isPrimary || event.button !== 0) return;
			const target = event.target;
			if (!(target instanceof Element)) return;
			const divider = target.closest<HTMLElement>("[data-section-divider]");
			if (divider) {
				const sectionId = divider.dataset.sectionDivider;
				if (
					!sectionId ||
					!viewEl.contains(divider) ||
					target.closest("button, input, [role=combobox]")
				)
					return;
				const first = store
					.get(lyricLinesAtom)
					.lyricLines.find((line) => line.sectionId === sectionId);
				if (!first) return;
				divider.setPointerCapture(event.pointerId);
				store.set(lineDragAtom, {
					id: first.id,
					sectionId,
					pointerId: event.pointerId,
					startX: event.clientX,
					startY: event.clientY,
					isDragging: false,
				});
				return;
			}
			const lineElement = target.closest<HTMLElement>("[data-lyric-line-id]");
			if (
				target.closest(
					"input, [data-lyric-word-interactive], [data-lyric-line-interactive]",
				)
			)
				return;
			const lineId = lineElement?.dataset.lyricLineId;
			if (!lineElement || !lineId || !viewEl.contains(lineElement)) return;
			lineElement.setPointerCapture(event.pointerId);
			store.set(lineDragAtom, {
				id: lineId,
				pointerId: event.pointerId,
				startX: event.clientX,
				startY: event.clientY,
				isDragging: false,
			});
		};
		const updatePointer = (event: PointerEvent) => {
			const drag = store.get(lineDragAtom);
			if (!drag || drag.pointerId !== event.pointerId) return;
			if (!drag.isDragging) {
				if (
					Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) <
					5
				)
					return;
				store.set(lineDragAtom, { ...drag, isDragging: true });
				store.set(draggingIdAtom, drag.id);
				if (drag.sectionId) {
					// The section's lines are what moves, and can't be a drop target.
					store.set(
						selectedLinesAtom,
						new Set(
							store
								.get(lyricLinesAtom)
								.lyricLines.filter((line) => line.sectionId === drag.sectionId)
								.map((line) => line.id),
						),
					);
				}
				showDragPreview(drag.id);
			}
			event.preventDefault();
			pointer = { x: event.clientX, y: event.clientY };
			updateDragPreview();
			updateDropTarget();
			ensureScrolling();
		};

		const finishDragging = (event?: PointerEvent) => {
			const drag = store.get(lineDragAtom);
			if (!drag || (event && drag.pointerId !== event.pointerId)) return;
			const sectionId = drag.sectionId;
			const slot = sectionSlot;
			if (drag.isDragging && sectionId) {
				if (slot)
					editLyricLines((state) => {
						moveSectionTo(state, sectionId, slot);
					});
			} else if (drag.isDragging && dropTarget) {
				const targetId = dropTarget.element.dataset.lyricLineId;
				const insertAfter = dropTarget.insertAfter;
				const selectedLines = store.get(selectedLinesAtom);
				const selectedLineIds = selectedLines.has(drag.id)
					? selectedLines
					: new Set([drag.id]);
				editLyricLines((state) => {
					const filteredLines = state.lyricLines.filter(
						(line) => !selectedLineIds.has(line.id),
					);
					const targetLines = state.lyricLines.filter((line) =>
						selectedLineIds.has(line.id),
					);
					const targetIndex = filteredLines.findIndex(
						(line) => line.id === targetId,
					);
					if (targetIndex < 0) return;
					const insertionIndex = targetIndex + Number(insertAfter);
					state.lyricLines = filteredLines;
					// Lines dropped inside a section join it instead of splitting it.
					insertLinesInSection(
						state,
						insertionIndex,
						targetLines,
						sectionIdAt(filteredLines, insertionIndex),
					);
				});
			}
			clearDropTarget();
			clearDragPreview();
			if (drag.isDragging) store.set(lastLineDragEndAtom, Date.now());
			store.set(lineDragAtom, null);
			store.set(draggingIdAtom, "");
			stopScrolling();
		};

		const scrollWithWheel = (event: WheelEvent) => {
			if (!store.get(lineDragAtom)?.isDragging || event.deltaY === 0) return;
			const computedLineHeight = Number.parseFloat(
				getComputedStyle(viewEl).lineHeight,
			);
			const lineHeight = Number.isFinite(computedLineHeight)
				? computedLineHeight
				: 16;
			const delta = normalizeWheelDelta(
				event.deltaY,
				event.deltaMode,
				lineHeight,
				viewEl.clientHeight,
			);
			const maxScrollTop = viewEl.scrollHeight - viewEl.clientHeight;
			viewEl.scrollTop = clampScrollTop(viewEl.scrollTop, delta, maxScrollTop);
			event.preventDefault();
		};
		const handleWindowBlur = () => finishDragging();

		window.addEventListener("pointerdown", startPointerDrag, true);
		window.addEventListener("pointermove", updatePointer, true);
		window.addEventListener("pointerup", finishDragging, true);
		window.addEventListener("pointercancel", finishDragging, true);
		window.addEventListener("wheel", scrollWithWheel, {
			capture: true,
			passive: false,
		});
		window.addEventListener("blur", handleWindowBlur);

		return () => {
			finishDragging();
			window.removeEventListener("pointerdown", startPointerDrag, true);
			window.removeEventListener("pointermove", updatePointer, true);
			window.removeEventListener("pointerup", finishDragging, true);
			window.removeEventListener("pointercancel", finishDragging, true);
			window.removeEventListener("wheel", scrollWithWheel, true);
			window.removeEventListener("blur", handleWindowBlur);
		};
	}, [editLyric.length, editLyricLines, store, toolMode, viewElRef]);
}
