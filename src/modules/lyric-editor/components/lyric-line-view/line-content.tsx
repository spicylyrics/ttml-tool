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

import { AddFilled } from "@fluentui/react-icons";
import { Flex, IconButton, Text } from "@radix-ui/themes";
import classNames from "classnames";
import { ROLE_COLORS, SlIcon } from "$/components/SlIcon";
import { ToolMode } from "$/states/main.ts";
import styles from "../index.module.css";
import { LineTimingControls } from "./line-timing-controls.tsx";
import { LineWordRow } from "./line-word-row.tsx";
import { SubLineEdit } from "./sub-line-edit";
import type { LyricLineViewState } from "./use-line-view";

export function LineContent({
	lineAtom,
	lineIndex,
	t,
	line,
	words,
	lineSelected,
	toolMode,
	editLyricLines,
	showTimestamps,
	showEndTimeAsDuration,
	store,
	wordsContainerRef,
	displayNumber,
	showWordRomanizationInput,
	showTranslation,
	showRomanization,
	wordTexts,
	editingRomanWordIndexAtom,
	legacySpaceLabels,
	syncWordWrap,
	startTimeRef,
	endTimeRef,
	enableInsert,
	toggleInsert,
	endTimeLinked,
	onToggleEndTimeLink,
}: Pick<
	LyricLineViewState,
	| "lineAtom"
	| "lineIndex"
	| "t"
	| "line"
	| "words"
	| "lineSelected"
	| "toolMode"
	| "editLyricLines"
	| "showTimestamps"
	| "showEndTimeAsDuration"
	| "store"
	| "wordsContainerRef"
	| "displayNumber"
	| "showWordRomanizationInput"
	| "showTranslation"
	| "showRomanization"
	| "wordTexts"
	| "editingRomanWordIndexAtom"
	| "legacySpaceLabels"
	| "syncWordWrap"
	| "startTimeRef"
	| "endTimeRef"
	| "enableInsert"
	| "toggleInsert"
	| "endTimeLinked"
	| "onToggleEndTimeLink"
>) {
	return (
		<>
			<Flex
				direction="column"
				align="center"
				justify="center"
				ml="3"
				style={{ minWidth: "40px" }}
			>
				<Text
					className={classNames(
						styles.lineNumber,
						line.ignoreSync && styles.ignored,
					)}
					align="center"
					color="gray"
				>
					{displayNumber > 0 && displayNumber}
				</Text>
				{line.isBG && (
					<SlIcon
						name="background"
						className={styles.roleBadge}
						color={ROLE_COLORS.background}
					/>
				)}
				{line.isDuet && (
					<SlIcon
						name="duet"
						className={styles.roleBadge}
						color={ROLE_COLORS.duet}
					/>
				)}
			</Flex>
			<div
				className={classNames(
					styles.lyricLineContainer,
					toolMode === ToolMode.Edit && styles.edit,
					toolMode === ToolMode.Sync && styles.sync,
				)}
			>
				<LineWordRow
					lineIndex={lineIndex}
					t={t}
					line={line}
					words={words}
					toolMode={toolMode}
					editLyricLines={editLyricLines}
					showTimestamps={showTimestamps}
					store={store}
					wordsContainerRef={wordsContainerRef}
					showWordRomanizationInput={showWordRomanizationInput}
					wordTexts={wordTexts}
					editingRomanWordIndexAtom={editingRomanWordIndexAtom}
					legacySpaceLabels={legacySpaceLabels}
					syncWordWrap={syncWordWrap}
					enableInsert={enableInsert}
				/>
				{toolMode === ToolMode.Edit && (
					<>
						{showTranslation &&
							(lineSelected || line.translatedLyric?.trim()) && (
								<SubLineEdit
									lineAtom={lineAtom}
									lineIndex={lineIndex}
									type="translatedLyric"
								/>
							)}
						{showRomanization && (lineSelected || line.romanLyric?.trim()) && (
							<SubLineEdit
								lineAtom={lineAtom}
								lineIndex={lineIndex}
								type="romanLyric"
							/>
						)}
					</>
				)}
			</div>
			{toolMode === ToolMode.Edit && (
				<Flex p="3">
					<IconButton
						data-lyric-line-interactive=""
						size="1"
						variant={enableInsert ? "solid" : "soft"}
						onClick={(evt) => {
							evt.preventDefault();
							evt.stopPropagation();
							toggleInsert();
						}}
					>
						<AddFilled />
					</IconButton>
				</Flex>
			)}
			{
				<LineTimingControls
					line={line}
					toolMode={toolMode}
					showTimestamps={showTimestamps}
					showEndTimeAsDuration={showEndTimeAsDuration}
					startTimeRef={startTimeRef}
					endTimeRef={endTimeRef}
					endTimeLinked={endTimeLinked}
					onToggleEndTimeLink={onToggleEndTimeLink}
				/>
			}
		</>
	);
}
