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

import { useAtomValue } from "jotai";
import {
	type KeyboardEvent,
	type MouseEvent,
	type PointerEvent,
	type RefObject,
	useEffect,
	useRef,
} from "react";
import { cmdClearWordTiming } from "$/modules/keyboard/commands";
import type { LyricLine, LyricWord } from "$/types/ttml.ts";
import { matchesMouseShortcut } from "$/utils/keybindings";
import { msToTimestamp } from "$/utils/timestamp.ts";
import { runOnClickUnlessScrolling } from "../../utils/click-unless-scrolling.ts";
import { getSynchronizableUnits } from "../../utils/lyric-states.ts";
import type { useSyncWordEditing } from "./use-sync-word-editing";

export const useSyncWordEvents = ({
	line,
	syncId,
	syncLevelMode,
	wordIndex,
	lineIndex,
	word,
	editableField,
	enableTimeModeDoubleClickEdit,
	enableManualTimestampEdit,
	enableTimingClear,
	startTime,
	endTime,
	lastClickTimeRef,
	setSelectedLines,
	setSelectedWords,
	setEditingWordState,
	setOpenSplitWordDialog,
	editing,
}: {
	line: LyricLine;
	syncId: string;
	syncLevelMode: "word" | "line";
	wordIndex: number;
	lineIndex: number;
	word: LyricWord;
	editableField: "word" | "romanWord";
	enableTimeModeDoubleClickEdit: boolean;
	enableManualTimestampEdit: boolean;
	enableTimingClear: boolean;
	startTime: number;
	endTime: number;
	lastClickTimeRef: RefObject<number>;
	setSelectedLines: (recipe: (state: Set<string>) => void) => void;
	setSelectedWords: (recipe: (state: Set<string>) => void) => void;
	setEditingWordState: (state: {
		wordIndex: number;
		lineIndex: number;
		word: string;
	}) => void;
	setOpenSplitWordDialog: (open: boolean) => void;
	editing: ReturnType<typeof useSyncWordEditing>;
}) => {
	const clearTimingKeys = useAtomValue(cmdClearWordTiming.atom);
	const {
		editingInput,
		setEditingTime,
		setEditingInput,
		setEditingTextField,
		setEditingTextValue,
		editingTextValueRef,
		commitTimeEdit,
		commitTextEdit,
		cancelTextEdit,
		clearTiming,
	} = editing;
	const cancelPendingClearRef = useRef<() => void>(() => {});
	// Leaving the Time tab or unmounting the word drops a press not yet released.
	useEffect(() => {
		if (!enableTimingClear) cancelPendingClearRef.current();
		return () => cancelPendingClearRef.current();
	}, [enableTimingClear]);
	const onWordPointerDown = (evt: PointerEvent<HTMLDivElement>) => {
		evt.stopPropagation();
		evt.preventDefault();
		if (enableTimingClear && matchesMouseShortcut(clearTimingKeys, evt)) {
			lastClickTimeRef.current = 0;
			cancelPendingClearRef.current();
			// Wait for the release: a middle press may be the start of scrolling.
			cancelPendingClearRef.current = runOnClickUnlessScrolling(
				evt,
				clearTiming,
			);
			return;
		}
		setSelectedLines((state) => {
			state.clear();
			state.add(line.id);
		});
		setSelectedWords((state) => {
			state.clear();
			if (syncLevelMode === "line") {
				const units = getSynchronizableUnits(line);
				for (const unit of units) {
					state.add(unit.id);
				}
			} else {
				state.add(syncId);
			}
		});
	};
	const onWordAuxClick = (evt: MouseEvent<HTMLDivElement>) => {
		if (!enableTimingClear || !matchesMouseShortcut(clearTimingKeys, evt))
			return;
		evt.preventDefault();
		evt.stopPropagation();
	};
	const onWordClick = (evt: MouseEvent<HTMLDivElement>) => {
		evt.stopPropagation();
		evt.preventDefault();

		const now = Date.now();
		const clickInterval = now - lastClickTimeRef.current;
		lastClickTimeRef.current = now;

		// Only trigger double-click actions within the standard double-click window.
		if (clickInterval > 300) return;

		if (evt.ctrlKey || evt.metaKey) {
			setEditingWordState({
				wordIndex,
				lineIndex,
				word: word.word,
			});
			setOpenSplitWordDialog(true);
			return;
		}
		if (!enableTimeModeDoubleClickEdit) return;

		const value = word[editableField] || "";
		editingTextValueRef.current = value;
		setEditingTextValue(value);
		setEditingTextField(editableField);
	};
	const onStartTimeClick = (e: MouseEvent<HTMLDivElement>) => {
		if (!enableManualTimestampEdit) return;
		e.stopPropagation();
		setEditingInput(msToTimestamp(startTime));
		setEditingTime("start");
	};
	const onStartTimeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") commitTimeEdit("start", editingInput);
		if (e.key === "Escape") setEditingTime(null);
		e.stopPropagation();
	};
	const onTextKeyDown = (
		event: KeyboardEvent<HTMLInputElement>,
		editingTextField: "word" | "romanWord",
	) => {
		event.stopPropagation();
		if (event.key === "Enter") {
			event.preventDefault();
			commitTextEdit(editingTextField, event.currentTarget.value);
		}
		if (event.key === "Escape") {
			event.preventDefault();
			cancelTextEdit();
		}
	};
	const onEndTimeClick = (e: MouseEvent<HTMLDivElement>) => {
		if (!enableManualTimestampEdit) return;
		e.stopPropagation();
		setEditingInput(msToTimestamp(endTime));
		setEditingTime("end");
	};
	const onEndTimeKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.key === "Enter") commitTimeEdit("end", editingInput);
		if (e.key === "Escape") setEditingTime(null);
		e.stopPropagation();
	};
	return {
		onWordPointerDown,
		onWordAuxClick,
		onWordClick,
		onStartTimeClick,
		onStartTimeKeyDown,
		onTextKeyDown,
		onEndTimeClick,
		onEndTimeKeyDown,
	};
};
