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

import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	ToolMode,
} from "$/states/main";
import { lastLineDragEndAtom, lineDragAtom } from "../lyric-line-view-states";
import type { LyricLineViewState } from "./use-line-view";

export function useLineInteractions({
	line,
	lineIndex,
	toolMode,
	blockDragRef,
	store,
	setSelectedLines,
	setSelectedWords,
}: Pick<
	LyricLineViewState,
	| "line"
	| "lineIndex"
	| "toolMode"
	| "blockDragRef"
	| "store"
	| "setSelectedLines"
	| "setSelectedWords"
>) {
	const onPointerDown: React.PointerEventHandler<HTMLDivElement> = (evt) => {
		if (
			(evt.target as HTMLElement | null)?.closest(
				"[data-lyric-word-interactive], [data-lyric-line-interactive]",
			)
		)
			return;
		blockDragRef.current =
			(evt.target as HTMLElement | null)?.tagName === "INPUT";
		if (toolMode !== ToolMode.Edit || blockDragRef.current || evt.button !== 0)
			return;
		evt.currentTarget.setPointerCapture(evt.pointerId);
		store.set(lineDragAtom, {
			id: line.id,
			pointerId: evt.pointerId,
			startX: evt.clientX,
			startY: evt.clientY,
			isDragging: false,
		});
	};
	const onPointerUp: React.PointerEventHandler<HTMLDivElement> = () => {
		blockDragRef.current = false;
	};
	const onClick: React.MouseEventHandler<HTMLDivElement> = (evt) => {
		if (
			(evt.target as HTMLElement | null)?.closest(
				"[data-lyric-word-interactive], [data-lyric-line-interactive]",
			)
		)
			return;
		evt.stopPropagation();
		evt.preventDefault();

		const now = Date.now();
		if (now - store.get(lastLineDragEndAtom) < 250) return;
		if (evt.ctrlKey) {
			setSelectedLines((v) => {
				if (v.has(line.id)) {
					v.delete(line.id);
				} else {
					v.add(line.id);
				}
			});
		} else if (evt.shiftKey) {
			setSelectedLines((v) => {
				if (v.size > 0) {
					let minBoundry = Number.NaN;
					let maxBoundry = Number.NaN;
					const lyricLines = store.get(lyricLinesAtom).lyricLines;
					lyricLines.forEach((line, i) => {
						if (v.has(line.id)) {
							if (Number.isNaN(minBoundry)) minBoundry = i;
							if (Number.isNaN(maxBoundry)) maxBoundry = i;

							minBoundry = Math.min(minBoundry, i, lineIndex);
							maxBoundry = Math.max(maxBoundry, i, lineIndex);
						}
					});
					for (let i = minBoundry; i <= maxBoundry; i++) {
						v.add(lyricLines[i].id);
					}
				} else {
					v.add(line.id);
				}
			});
		} else {
			if (
				line.sectionId &&
				store.get(collapsedSectionIdsAtom).has(line.sectionId)
			) {
				setSelectedLines((state) => {
					state.clear();
					for (const candidate of store.get(lyricLinesAtom).lyricLines) {
						if (candidate.sectionId === line.sectionId) state.add(candidate.id);
					}
				});
				return;
			}
			setSelectedLines((state) => {
				if (!state.has(line.id) || state.size !== 1) {
					state.clear();
					state.add(line.id);
				}
			});
			setSelectedWords((state) => {
				state.clear();
			});
		}
	};
	return { onPointerDown, onPointerUp, onClick };
}
