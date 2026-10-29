/*
 * Copyright 2023-2026 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/spicylyrics/ttml-tool/blob/main/LICENSE
 */

import classNames from "classnames";
import { type Atom, atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, useMemo } from "react";
import {
	enableManualTimestampEditAtom,
	enableSyncGlowAnimationAtom,
	highlightActiveWordAtom,
	highlightErrorsAtom,
	showTimestampsAtom,
} from "$/modules/settings/states/index.ts";
import { instantHighlightFadeAtom } from "$/modules/settings/states/preview";
import {
	enableTimeModeDoubleClickEditAtom,
	syncLevelModeAtom,
	visualizeTimestampUpdateAtom,
} from "$/modules/settings/states/sync.ts";
import { splitWordDialogAtom } from "$/states/dialogs.ts";
import {
	editingWordStateAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	showEndTimeAsDurationAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import type { LyricLine, LyricWord } from "$/types/ttml.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";
import { hasNoTiming } from "../../utils/timing-status";
import styles from "../index.module.css";
import { UntimedTimestamp } from "../untimed-timestamp";
import { useSyncWordEvents } from "./use-sync-word-events";
import { useSyncWordLifecycle } from "./use-sync-word-lifecycle";

export const LyricSyncWordView: FC<{
	syncId: string;
	wordAtom: Atom<LyricWord>;
	line: LyricLine;
	startTime: number;
	endTime: number;
	displayWord: string;
	isWordBlank: boolean;
	wordIndex: number;
	lineIndex: number;
	editableField: "word" | "romanWord";
}> = ({
	syncId,
	wordAtom,
	line,
	startTime,
	endTime,
	displayWord,
	isWordBlank,
	wordIndex,
	lineIndex,
	editableField,
}) => {
	const word = useAtomValue(wordAtom);
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(syncId)),
		[syncId],
	);
	const isWordSelected = useAtomValue(isWordSelectedAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const visualizeTimestampUpdate = useAtomValue(visualizeTimestampUpdateAtom);
	const showTimestamps = useAtomValue(showTimestampsAtom);
	const showEndTimeAsDuration = useAtomValue(showEndTimeAsDurationAtom);
	const highlightErrors = useAtomValue(highlightErrorsAtom);
	const highlightActiveWord = useAtomValue(highlightActiveWordAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const syncLevelMode = useAtomValue(syncLevelModeAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const enableSyncGlowAnimation = useAtomValue(enableSyncGlowAnimationAtom);
	const enableManualTimestampEdit = useAtomValue(enableManualTimestampEditAtom);
	const enableTimeModeDoubleClickEdit = useAtomValue(
		enableTimeModeDoubleClickEditAtom,
	);

	const store = useStore();
	const {
		startTimeRef,
		endTimeRef,
		wordContainerRef,
		lastClickTimeRef,
		editing,
	} = useSyncWordLifecycle({
		store,
		startTime,
		endTime,
		highlightActiveWord,
		enableSyncGlowAnimation,
		visualizeTimestampUpdate,
		editLyricLines,
		line,
		wordIndex,
	});

	const {
		editingTime,
		editingInput,
		setEditingInput,
		editingTextField,
		editingTextValue,
		setEditingTextValue,
		editingTextInputRef,
		editingTextMeasureRef,
		editingTextValueRef,
		editingTextWidth,
		textForMeasurement,
		commitTextEdit,
		commitTimeEdit,
	} = editing;

	const startUntimed = hasNoTiming({ startTime, endTime });
	const endUntimed = endTime === 0;
	const startTimeDisplay = startUntimed ? (
		<UntimedTimestamp />
	) : (
		msToTimestamp(startTime)
	);
	const endTimeDisplay = endUntimed ? (
		<UntimedTimestamp />
	) : showEndTimeAsDuration ? (
		`+${endTime - startTime}ms`
	) : (
		msToTimestamp(endTime)
	);

	const instantFade = useAtomValue(instantHighlightFadeAtom);
	const hasError = useMemo(() => startTime > endTime, [startTime, endTime]);
	const setOpenSplitWordDialog = useSetAtom(splitWordDialogAtom);
	const setEditingWordState = useSetAtom(editingWordStateAtom);

	// active/animated classes are applied imperatively by the store.sub effect above
	const className = useMemo(
		() =>
			classNames(
				styles.lyricWord,
				styles.sync,
				instantFade && styles.hasInstantFade,
				isWordSelected && styles.selected,
				isWordBlank && styles.blank,
				hasError &&
					(toolMode === ToolMode.Edit ||
						(toolMode === ToolMode.Sync &&
							showTimestamps &&
							highlightErrors)) &&
					styles.error,
			),
		[
			instantFade,
			isWordBlank,
			isWordSelected,
			hasError,
			toolMode,
			showTimestamps,
			highlightErrors,
		],
	);

	const {
		onWordPointerDown,
		onWordAuxClick,
		onWordClick,
		onStartTimeClick,
		onStartTimeKeyDown,
		onTextKeyDown,
		onEndTimeClick,
		onEndTimeKeyDown,
	} = useSyncWordEvents({
		line,
		syncId,
		syncLevelMode,
		wordIndex,
		lineIndex,
		word,
		editableField,
		enableTimeModeDoubleClickEdit,
		enableManualTimestampEdit,
		enableTimingClear: toolMode === ToolMode.Sync,
		startTime,
		endTime,
		lastClickTimeRef,
		setSelectedLines,
		setSelectedWords,
		setEditingWordState,
		setOpenSplitWordDialog,
		editing,
	});

	return (
		<div
			ref={wordContainerRef}
			className={className}
			style={{ position: "relative", zIndex: 1 }}
			onPointerDown={onWordPointerDown}
			onAuxClick={onWordAuxClick}
			onContextMenu={onWordAuxClick}
			onClick={onWordClick}
		>
			{showTimestamps && (
				<div
					className={classNames(
						styles.startTime,
						startUntimed && styles.untimedTimestamp,
					)}
					ref={startTimeRef}
					title={
						enableManualTimestampEdit ? "Click to edit start time" : undefined
					}
					style={{ cursor: enableManualTimestampEdit ? "text" : "default" }}
					onClick={onStartTimeClick}
				>
					{editingTime === "start" ? (
						<input
							autoFocus
							value={editingInput}
							onChange={(e) => setEditingInput(e.target.value)}
							onBlur={() => commitTimeEdit("start", editingInput)}
							onKeyDown={onStartTimeKeyDown}
							onClick={(e) => e.stopPropagation()}
							style={{
								width: "100%",
								background: "transparent",
								border: "none",
								outline: "1px solid var(--accent-8)",
								borderRadius: "2px",
								color: "inherit",
								fontFamily: "inherit",
								fontSize: "inherit",
								textAlign: "center",
								padding: "0 2px",
							}}
						/>
					) : (
						startTimeDisplay
					)}
				</div>
			)}
			{editingTextField ? (
				<>
					<span
						ref={editingTextMeasureRef}
						className={styles.syncWordInputMeasure}
					>
						{textForMeasurement}
					</span>
					<input
						ref={editingTextInputRef}
						value={editingTextValue}
						style={
							editingTextWidth ? { width: `${editingTextWidth}px` } : undefined
						}
						onChange={(event) => {
							editingTextValueRef.current = event.currentTarget.value;
							setEditingTextValue(event.currentTarget.value);
						}}
						onBlur={(event) =>
							commitTextEdit(editingTextField, event.currentTarget.value)
						}
						onPointerDown={(event) => event.stopPropagation()}
						onClick={(event) => event.stopPropagation()}
						onKeyDown={(event) => onTextKeyDown(event, editingTextField)}
						className={styles.syncWordInput}
					/>
				</>
			) : (
				<div className={styles.displayWord}>{displayWord}</div>
			)}
			{showTimestamps && (
				<div
					className={classNames(
						styles.endTime,
						endUntimed && styles.untimedTimestamp,
					)}
					ref={endTimeRef}
					title={
						enableManualTimestampEdit ? "Click to edit end time" : undefined
					}
					style={{ cursor: enableManualTimestampEdit ? "text" : "default" }}
					onClick={onEndTimeClick}
				>
					{editingTime === "end" ? (
						<input
							autoFocus
							value={editingInput}
							onChange={(e) => setEditingInput(e.target.value)}
							onBlur={() => commitTimeEdit("end", editingInput)}
							onKeyDown={onEndTimeKeyDown}
							onClick={(e) => e.stopPropagation()}
							style={{
								width: "100%",
								background: "transparent",
								border: "none",
								outline: "1px solid var(--accent-8)",
								borderRadius: "2px",
								color: "inherit",
								fontFamily: "inherit",
								fontSize: "inherit",
								textAlign: "center",
								padding: "0 2px",
							}}
						/>
					) : (
						endTimeDisplay
					)}
				</div>
			)}
		</div>
	);
};
