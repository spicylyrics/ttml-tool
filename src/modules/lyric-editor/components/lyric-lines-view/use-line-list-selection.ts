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

import type { Atom } from "jotai";
import { atom, useAtomValue } from "jotai";
import { useMemo, useRef } from "react";
import {
	collapsedSectionIdsAtom,
	selectedLinesAtom,
	type ToolMode,
} from "$/states/main.ts";
import type { LyricLine } from "$/types/ttml.ts";
import { lyricLineStructureAtom } from "../../states/document-structure.ts";
import { shouldAutoCenterSelection } from "../selection-scroll";

export function useLineListSelection({
	editLyric,
	toolMode,
}: {
	editLyric: readonly Atom<LyricLine>[];
	toolMode: ToolMode;
}) {
	const scrollToIndexAtom = useMemo(
		() =>
			atom((get) => {
				if (!shouldAutoCenterSelection(toolMode)) return undefined;
				const selectedLines = get(selectedLinesAtom);
				if (selectedLines.size === 0) return undefined;
				const lyrics = get(lyricLineStructureAtom);
				const index = lyrics.findIndex((l) => selectedLines.has(l.id));
				return index === -1 ? undefined : index;
			}),
		[toolMode],
	);
	const scrollToIndex = useAtomValue(scrollToIndexAtom);
	const lastSelectionScrolledIndexRef = useRef<number | undefined>(undefined);
	const lastPlaybackScrolledIndexRef = useRef<number | undefined>(undefined);
	const lyricStructure = useAtomValue(lyricLineStructureAtom);
	const collapsedSections = useAtomValue(collapsedSectionIdsAtom);
	const visibleItems = useMemo(() => {
		const seenSections = new Set<string>();
		// Same keys as collapseKey, in one pass: a section, or a stretch of
		// lines outside any section named by its first line.
		let runKey: string | undefined;
		return editLyric
			.map((lineAtom, sourceIndex) => ({
				lineAtom,
				sourceIndex,
				line: lyricStructure[sourceIndex],
			}))
			.filter(({ line }) => {
				if (!line) return true;
				if (line.sectionId) runKey = undefined;
				else runKey ??= `unsectioned:${line.id}`;
				const key = line.sectionId ?? runKey;
				if (!key || !collapsedSections.has(key)) return true;
				// The first line stays to carry the divider; it draws only that.
				if (seenSections.has(key)) return false;
				seenSections.add(key);
				return true;
			});
	}, [editLyric, lyricStructure, collapsedSections]);

	return {
		scrollToIndex,
		lastSelectionScrolledIndexRef,
		lastPlaybackScrolledIndexRef,
		visibleItems,
	};
}
