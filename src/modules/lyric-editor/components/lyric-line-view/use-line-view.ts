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

import { type Atom, atom, useAtom, useAtomValue, useStore } from "jotai";
import { splitAtom } from "jotai/utils";
import { useSetImmerAtom } from "jotai-immer";
import { useCallback, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { activeLineIdsAtom } from "$/modules/audio/states/index.ts";
import { effectiveSyncLevelAtom } from "$/modules/line-sync/states";
import {
	advGeniusHeaderColorAtom,
	compactBGInSyncAtom,
	geniusCategorizationEnabledAtom,
	legacySpaceLabelsAtom,
	showLineRomanizationAtom,
	showLineTranslationAtom,
	showTimestampsAtom,
	showWordRomanizationInputAtom,
} from "$/modules/settings/states/index.ts";
import {
	editActiveLineHighlightAtom,
	syncActiveLineHighlightAtom,
	syncWordWrapAtom,
	visualizeTimestampUpdateAtom,
} from "$/modules/settings/states/sync.ts";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	showEndTimeAsDurationAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import type { LyricLine } from "$/types/ttml.ts";
import { lineDisplayNumbersAtom } from "../../states/document-structure.ts";
import {
	globalEnableInsertAtom,
	timingCopyPlacementAtom,
} from "../lyric-line-view-states.ts";
import {
	getCategoryColor,
	getHeaderType,
	hasTimingError,
} from "./line-presentation";
import { useLineTiming } from "./use-line-timing";

export function useLineView(lineAtom: Atom<LyricLine>, lineIndex: number) {
	const { t } = useTranslation();
	const line = useAtomValue(lineAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const lineSelectedAtom = useMemo(() => {
		const a = atom((get) => get(selectedLinesAtom).has(line.id));
		if (import.meta.env.DEV) {
			a.debugLabel = `lineSelectedAtom-${line.id}`;
		}
		return a;
	}, [line.id]);
	const wordsAtom = useMemo(
		() => splitAtom(atom((get) => get(lineAtom).words)),
		[lineAtom],
	);
	const words = useAtomValue(wordsAtom);
	const lineSelected = useAtomValue(lineSelectedAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const editActiveLineHighlight = useAtomValue(
		toolMode === ToolMode.Sync
			? syncActiveLineHighlightAtom
			: editActiveLineHighlightAtom,
	);
	const isPlaybackActiveAtom = useMemo(
		() =>
			atom((get) => {
				if (
					!get(
						get(toolModeAtom) === ToolMode.Sync
							? syncActiveLineHighlightAtom
							: editActiveLineHighlightAtom,
					)
				)
					return false;
				return get(activeLineIdsAtom).includes(line.id);
			}),
		[line.id],
	);
	const isPlaybackActive = useAtomValue(isPlaybackActiveAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const visualizeTimestampUpdate = useAtomValue(visualizeTimestampUpdateAtom);
	const showTimestamps = useAtomValue(showTimestampsAtom);
	const showEndTimeAsDuration = useAtomValue(showEndTimeAsDurationAtom);
	const syncLevelMode = useAtomValue(effectiveSyncLevelAtom);
	const store = useStore();
	const geniusCategorizationEnabled = useAtomValue(
		geniusCategorizationEnabledAtom,
	);
	const sectionAtom = useMemo(
		() =>
			atom((get) =>
				get(lyricLinesAtom).sections?.find(
					(section) => section.id === line.sectionId,
				),
			),
		[line.sectionId],
	);
	const activeSection = useAtomValue(sectionAtom);
	const sectionActionsEnabled = geniusCategorizationEnabled && !!activeSection;
	const manualCategorizationEnabled =
		geniusCategorizationEnabled && !activeSection;

	const activeGeniusHeader = geniusCategorizationEnabled
		? (activeSection?.label ?? line.geniusHeader)
		: undefined;

	const customHeaderColor = useAtomValue(advGeniusHeaderColorAtom);

	const headerType = useMemo(
		() => getHeaderType(activeGeniusHeader, activeSection),
		[activeGeniusHeader, activeSection],
	);

	// Subscribed, not read once: merging or moving the previous line into this
	// line's section has to hide this header right away, not after a remount.
	const isSectionStartAtom = useMemo(
		() =>
			atom((get) => {
				if (!activeGeniusHeader) return false;
				if (lineIndex === 0) return true;
				const prevLine = get(lyricLinesAtom).lyricLines[lineIndex - 1];
				return line.sectionId
					? prevLine?.sectionId !== line.sectionId
					: prevLine?.geniusHeader !== activeGeniusHeader;
			}),
		[activeGeniusHeader, line.sectionId, lineIndex],
	);
	const isSectionStart = useAtomValue(isSectionStartAtom);

	const categoryColor = useMemo(
		() => getCategoryColor(headerType),
		[headerType],
	);

	const wordsContainerRef = useRef<HTMLDivElement>(null);
	const blockDragRef = useRef(false);

	const isLastLineAtom = useMemo(
		() =>
			atom((get) => get(lyricLinesAtom).lyricLines.length - 1 === lineIndex),
		[lineIndex],
	);
	const isLastLine = useAtomValue(isLastLineAtom);

	const selectedLinesCountAtom = useMemo(
		() => atom((get) => get(selectedLinesAtom).size),
		[],
	);

	// 创建一个仅订阅当前行显示行号的 atom，优化性能
	const displayNumberAtom = useMemo(
		() => atom((get) => get(lineDisplayNumbersAtom)[lineIndex]),
		[lineIndex],
	);
	const displayNumber = useAtomValue(displayNumberAtom);
	const selectedLinesCount = useAtomValue(selectedLinesCountAtom);

	const hasError = useMemo(
		() =>
			hasTimingError({
				startTime: line.startTime,
				endTime: line.endTime,
				words: line.words,
			}),
		[line.startTime, line.endTime, line.words],
	);

	const showWordRomanizationInput = useAtomValue(showWordRomanizationInputAtom);
	const showTranslation = useAtomValue(showLineTranslationAtom);
	const showRomanization = useAtomValue(showLineRomanizationAtom);
	const wordTexts = useMemo(
		() => line.words.map((lineWord) => lineWord.word),
		[line.words],
	);
	const editingRomanWordIndexAtom = useMemo(
		() => atom<number | null>(null),
		[],
	);
	const editingRomanWordIndex = useAtomValue(editingRomanWordIndexAtom);
	const compactBGInSync = useAtomValue(compactBGInSyncAtom);
	const legacySpaceLabels = useAtomValue(legacySpaceLabelsAtom);
	const syncWordWrap = useAtomValue(syncWordWrapAtom);

	const startTimeRef = useRef<HTMLDivElement>(null);
	const endTimeRef = useRef<HTMLButtonElement>(null);
	const [enableInsertLocal, setEnableInsertLocal] = useState(false);
	const [globalEnableInsert, setGlobalEnableInsert] = useAtom(
		globalEnableInsertAtom,
	);
	const [timingCopyPlacement, setTimingCopyPlacement] = useAtom(
		timingCopyPlacementAtom,
	);
	const enableInsert = enableInsertLocal || globalEnableInsert;

	const disableInsert = useCallback(() => {
		setEnableInsertLocal(false);
		if (globalEnableInsert) setGlobalEnableInsert(false);
	}, [globalEnableInsert, setGlobalEnableInsert]);

	const toggleInsert = useCallback(() => {
		if (enableInsert) disableInsert();
		else setEnableInsertLocal(true);
	}, [enableInsert, disableInsert]);

	const { endTimeLinked, onToggleEndTimeLink } = useLineTiming({
		line,
		lineIndex,
		visualizeTimestampUpdate,
		startTimeRef,
		endTimeRef,
		toolMode,
		disableInsert,
		store,
		editLyricLines,
	});

	return {
		lineAtom,
		lineIndex,
		t,
		line,
		setSelectedLines,
		words,
		lineSelected,
		toolMode,
		editActiveLineHighlight,
		isPlaybackActive,
		setSelectedWords,
		editLyricLines,
		showTimestamps,
		showEndTimeAsDuration,
		syncLevelMode,
		store,
		activeSection,
		sectionActionsEnabled,
		manualCategorizationEnabled,
		activeGeniusHeader,
		customHeaderColor,
		isSectionStart,
		categoryColor,
		wordsContainerRef,
		blockDragRef,
		isLastLine,
		selectedLinesCountAtom,
		displayNumber,
		selectedLinesCount,
		hasError,
		showWordRomanizationInput,
		showTranslation,
		showRomanization,
		wordTexts,
		editingRomanWordIndexAtom,
		editingRomanWordIndex,
		compactBGInSync,
		legacySpaceLabels,
		syncWordWrap,
		startTimeRef,
		endTimeRef,
		enableInsertLocal,
		globalEnableInsert,
		timingCopyPlacement,
		setTimingCopyPlacement,
		enableInsert,
		disableInsert,
		toggleInsert,
		endTimeLinked,
		onToggleEndTimeLink,
		visualizeTimestampUpdate,
	};
}
export type LyricLineViewState = ReturnType<typeof useLineView>;
