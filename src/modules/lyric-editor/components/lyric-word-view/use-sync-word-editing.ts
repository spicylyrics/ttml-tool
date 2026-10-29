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

import type { Draft } from "immer";
import {
	useCallback,
	useEffect,
	useLayoutEffect,
	useRef,
	useState,
} from "react";
import type { LyricLine, TTMLLyric } from "$/types/ttml.ts";
import { parseTimespan } from "$/utils/timestamp.ts";

export const useSyncWordEditing = ({
	editLyricLines,
	line,
	wordIndex,
}: {
	editLyricLines: (recipe: (state: Draft<TTMLLyric>) => void) => void;
	line: LyricLine;
	wordIndex: number;
}) => {
	// Inline timestamp editing state: null = not editing, "start" | "end" = editing that field
	const [editingTime, setEditingTime] = useState<"start" | "end" | null>(null);
	const [editingInput, setEditingInput] = useState("");
	const timeEditCancelledRef = useRef(false);
	useEffect(() => {
		if (editingTime) timeEditCancelledRef.current = false;
	}, [editingTime]);
	const [editingTextField, setEditingTextField] = useState<
		"word" | "romanWord" | null
	>(null);
	const [editingTextValue, setEditingTextValue] = useState("");
	const editingTextInputRef = useRef<HTMLInputElement>(null);
	const editingTextMeasureRef = useRef<HTMLSpanElement>(null);
	const editingTextValueRef = useRef("");
	// Escape unmounts the input, and the resulting blur must not commit.
	const textEditCancelledRef = useRef(false);
	const [editingTextWidth, setEditingTextWidth] = useState<number>();
	const textForMeasurement = editingTextValue || " ";

	useEffect(() => {
		if (!editingTextField) return;
		textEditCancelledRef.current = false;
		editingTextInputRef.current?.focus();
		editingTextInputRef.current?.select();
	}, [editingTextField]);

	useLayoutEffect(() => {
		if (
			!editingTextField ||
			!editingTextMeasureRef.current ||
			!textForMeasurement
		)
			return;
		setEditingTextWidth(
			Math.ceil(editingTextMeasureRef.current.getBoundingClientRect().width),
		);
	}, [editingTextField, textForMeasurement]);

	const commitTextEdit = useCallback(
		(field: "word" | "romanWord", value: string) => {
			if (textEditCancelledRef.current) return;
			editLyricLines((state) => {
				const targetLine = state.lyricLines.find((item) => item.id === line.id);
				const targetWord = targetLine?.words[wordIndex];
				if (!targetWord) return;
				targetWord[field] = value;
			});
			setEditingTextField(null);
		},
		[editLyricLines, line.id, wordIndex],
	);

	useEffect(() => {
		if (!editingTextField) return;

		const commitOnOutsidePointerDown = (event: PointerEvent) => {
			if (editingTextInputRef.current?.contains(event.target as Node)) return;
			commitTextEdit(editingTextField, editingTextValueRef.current);
		};

		document.addEventListener("pointerdown", commitOnOutsidePointerDown, true);
		return () =>
			document.removeEventListener(
				"pointerdown",
				commitOnOutsidePointerDown,
				true,
			);
	}, [commitTextEdit, editingTextField]);

	const cancelTextEdit = useCallback(() => {
		textEditCancelledRef.current = true;
		setEditingTextField(null);
	}, []);

	const commitTimeEdit = useCallback(
		(field: "start" | "end", rawValue: string) => {
			if (timeEditCancelledRef.current) return;
			try {
				const newMs = parseTimespan(rawValue);
				editLyricLines((state) => {
					const targetLine = state.lyricLines.find((l) => l.id === line.id);
					if (!targetLine) return;
					const word = targetLine.words[wordIndex];
					if (!word) return;
					if (field === "start") word.startTime = newMs;
					else word.endTime = newMs;
				});
			} catch {
				// invalid format — silently revert
			}
			setEditingTime(null);
		},
		[editLyricLines, line.id, wordIndex],
	);

	const clearTiming = useCallback(() => {
		// Removing a timestamp input can blur it; do not restore its old value.
		timeEditCancelledRef.current = true;
		setEditingTime(null);
		const wordId = line.words[wordIndex]?.id;
		if (!wordId) return;
		editLyricLines((state) => {
			const targetLine = state.lyricLines.find((item) => item.id === line.id);
			const targetWord = targetLine?.words.find((item) => item.id === wordId);
			if (!targetWord) return;
			targetWord.startTime = 0;
			targetWord.endTime = 0;
		});
	}, [editLyricLines, line, wordIndex]);

	return {
		clearTiming,
		editingTime,
		setEditingTime,
		editingInput,
		setEditingInput,
		editingTextField,
		setEditingTextField,
		editingTextValue,
		setEditingTextValue,
		editingTextInputRef,
		editingTextMeasureRef,
		editingTextValueRef,
		editingTextWidth,
		textForMeasurement,
		commitTextEdit,
		cancelTextEdit,
		commitTimeEdit,
	};
};
