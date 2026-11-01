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

import { ContextMenu, Flex } from "@radix-ui/themes";
import classNames from "classnames";
import { type Atom, atom, useAtomValue } from "jotai";
import { type FC, memo, useMemo } from "react";
import {
	collapsedSectionIdsAtom,
	selectedLinesAtom,
	ToolMode,
} from "$/states/main.ts";
import type { LyricLine } from "$/types/ttml.ts";
import styles from "../index.module.css";
import { InsertLineButton } from "./insert-line-button";
import { LineContent } from "./line-content.tsx";
import { LineContextMenu } from "./line-context-menu.tsx";
import { LineTimingPlacement } from "./line-timing-placement.tsx";
import { LineTrailingInsert } from "./line-trailing-insert.tsx";
import { LyricLineScroller } from "./lyric-line-scroller";
import { SectionDivider } from "./section-divider.tsx";
import { useLineInteractions } from "./use-line-interactions";
import { useLineView } from "./use-line-view";

export const LyricLineView: FC<{
	lineAtom: Atom<LyricLine>;
	lineIndex: number;
}> = memo(({ lineAtom, lineIndex }) => {
	const {
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
		store,
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
	} = useLineView(lineAtom, lineIndex);
	const { onPointerDown, onPointerUp, onClick } = useLineInteractions({
		line,
		lineIndex,
		toolMode,
		blockDragRef,
		store,
		setSelectedLines,
		setSelectedWords,
	});
	// A stretch outside any section is keyed by its first line, and when it's
	// collapsed only that line is in the list, so its own id is enough here.
	const collapseKey = line.sectionId ?? `unsectioned:${line.id}`;
	const collapsedAtom = useMemo(
		() => atom((get) => get(collapsedSectionIdsAtom).has(collapseKey)),
		[collapseKey],
	);
	const collapsed = useAtomValue(collapsedAtom);

	const sectionDivider = (
		<SectionDivider
			lineIndex={lineIndex}
			sectionId={line.sectionId}
			geniusHeader={line.geniusHeader}
		/>
	);

	// The list keeps a collapsed section's first line only to carry its
	// divider, so the line itself stays hidden like the rest.
	if (collapsed) return sectionDivider;

	return (
		<>
			{lineSelected && (
				<LyricLineScroller
					lineAtom={lineAtom}
					wordsContainer={wordsContainerRef.current}
					editingRomanWordIndex={editingRomanWordIndex}
				/>
			)}
			{sectionDivider}
			{
				<LineTimingPlacement
					lineIndex={lineIndex}
					t={t}
					editLyricLines={editLyricLines}
					store={store}
					timingCopyPlacement={timingCopyPlacement}
					setTimingCopyPlacement={setTimingCopyPlacement}
				/>
			}
			{enableInsert && (
				<InsertLineButton
					lineIndex={lineIndex}
					selectedLinesCountAtom={selectedLinesCountAtom}
					disableInsert={disableInsert}
				/>
			)}
			<ContextMenu.Root
				onOpenChange={(opened) => {
					if (opened) {
						if (!store.get(selectedLinesAtom).has(line.id)) {
							store.set(selectedLinesAtom, new Set([line.id]));
						}
					}
				}}
			>
				<ContextMenu.Trigger
					disabled={toolMode === ToolMode.Preview}
					onContextMenu={(evt) => {
						if (
							(evt.target as HTMLElement | null)?.closest(
								"[data-lyric-word-interactive], [data-lyric-line-interactive]",
							)
						) {
							evt.preventDefault();
							evt.stopPropagation();
						}
					}}
				>
					<Flex
						mx="1"
						my={
							line.isBG && toolMode === ToolMode.Sync && compactBGInSync
								? "0"
								: "1"
						}
						direction="row"
						className={classNames(
							styles.lyricLine,
							line.isBG &&
								toolMode === ToolMode.Sync &&
								compactBGInSync &&
								styles.bg,
							lineSelected && styles.selected,
							editActiveLineHighlight &&
								isPlaybackActive &&
								(toolMode === ToolMode.Edit || toolMode === ToolMode.Sync) &&
								styles.activePlayback,
							toolMode === ToolMode.Sync && styles.sync,
							toolMode === ToolMode.Edit && styles.edit,
							line.ignoreSync && styles.ignoreSync,
							hasError && toolMode === ToolMode.Edit && styles.error,
						)}
						align="center"
						gapX="4"
						data-lyric-line-draggable={
							toolMode === ToolMode.Edit ? "" : undefined
						}
						data-lyric-line-id={line.id}
						data-lyric-line-index={lineIndex}
						onPointerDown={onPointerDown}
						onPointerUp={onPointerUp}
						onClick={onClick}
						asChild
					>
						<div>
							<LineContent
								lineAtom={lineAtom}
								lineIndex={lineIndex}
								t={t}
								line={line}
								words={words}
								lineSelected={lineSelected}
								toolMode={toolMode}
								editLyricLines={editLyricLines}
								showTimestamps={showTimestamps}
								showEndTimeAsDuration={showEndTimeAsDuration}
								store={store}
								wordsContainerRef={wordsContainerRef}
								displayNumber={displayNumber}
								showWordRomanizationInput={showWordRomanizationInput}
								showTranslation={showTranslation}
								showRomanization={showRomanization}
								wordTexts={wordTexts}
								editingRomanWordIndexAtom={editingRomanWordIndexAtom}
								legacySpaceLabels={legacySpaceLabels}
								syncWordWrap={syncWordWrap}
								startTimeRef={startTimeRef}
								endTimeRef={endTimeRef}
								enableInsert={enableInsert}
								toggleInsert={toggleInsert}
								endTimeLinked={endTimeLinked}
								onToggleEndTimeLink={onToggleEndTimeLink}
							/>
						</div>
					</Flex>
				</ContextMenu.Trigger>
				<LineContextMenu lineIndex={lineIndex} toolMode={toolMode} />
			</ContextMenu.Root>
			{
				<LineTrailingInsert
					lineIndex={lineIndex}
					t={t}
					editLyricLines={editLyricLines}
					store={store}
					isLastLine={isLastLine}
					selectedLinesCount={selectedLinesCount}
					enableInsertLocal={enableInsertLocal}
					globalEnableInsert={globalEnableInsert}
					disableInsert={disableInsert}
				/>
			}
		</>
	);
});
