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

import { ContextMenu } from "@radix-ui/themes";
import classNames from "classnames";
import { atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type SyntheticEvent,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { legacySpaceLabelsAtom } from "$/modules/settings/states/index.ts";
import { splitWordDialogAtom } from "$/states/dialogs.ts";
import {
	editingWordStateAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import { AutoSizeTextField } from "../../tools/AutoSizeTextField.tsx";
import styles from "../index.module.css";
import { LyricLineMenu } from "../lyric-line-menu.tsx";
import { LyricWordMenu } from "../lyric-word-menu";
import { LyricWordViewEditSpan } from "./LyricWordViewEditSpan";
import type { LyricWordViewEditProps } from "./types";
import { useWordBlank } from "./use-word-blank";
import { getDisplayWordText } from "./word-text";
export const LyricWordViewEdit = ({
	wordAtom,
	wordIndex,
	line,
	lineIndex,
}: LyricWordViewEditProps) => {
	const { t } = useTranslation();
	const word = useAtomValue(wordAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(get(wordAtom).id)),
		[wordAtom],
	);
	const isWordSelected = useAtomValue(isWordSelectedAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const setOpenSplitWordDialog = useSetAtom(splitWordDialogAtom);
	const setSplitState = useSetAtom(editingWordStateAtom);
	const [editing, setEditing] = useState(false);
	const [editingValue, setEditingValue] = useState(word.word);
	// Escape unmounts the input, and the resulting blur must not commit.
	const editCancelledRef = useRef(false);
	const store = useStore();
	const toolMode = useAtomValue(toolModeAtom);
	const isWordBlank = useWordBlank(word.word);
	const isSpaceWord = isWordBlank && word.word.length > 0;
	const legacySpaceLabels = useAtomValue(legacySpaceLabelsAtom);
	const useCompactSpace = isSpaceWord && !legacySpaceLabels;
	// In Edit Mode, we always want to see the original word in the capsule.
	const displayWord = getDisplayWordText(
		t,
		word.word,
		isWordBlank,
		word.romanWord,
		false,
	);
	const spaceLabel = isSpaceWord
		? t("lyricWordView.spaceCount", "Space ×{count}", {
				count: word.word.length,
			})
		: undefined;

	const hasError = useMemo(
		() => word.startTime > word.endTime,
		[word.startTime, word.endTime],
	);

	useEffect(() => {
		if (!editing) return;
		editCancelledRef.current = false;
		setEditingValue(word.word);
	}, [editing, word.word]);

	const className = useMemo(
		() =>
			classNames(
				styles.lyricWord,
				styles.edit,
				isWordSelected && styles.selected,
				isWordBlank && styles.blank,
				useCompactSpace && styles.compactSpace,
				hasError && toolMode === ToolMode.Edit && styles.error,
				word.splitUnsure && toolMode === ToolMode.Edit && styles.splitUnsure,
			),
		[
			isWordBlank,
			useCompactSpace,
			isWordSelected,
			hasError,
			toolMode,
			word.splitUnsure,
		],
	);
	const unsureLabel =
		word.splitUnsure && toolMode === ToolMode.Edit
			? t("unsureSplits.wordLabel", "Unsure split, check it")
			: undefined;
	const onEnter = useCallback(
		(evt: SyntheticEvent<HTMLInputElement>) => {
			if (editCancelledRef.current) return;
			setEditing(false);
			const parsedWord = evt.currentTarget.value;
			if (parsedWord !== word.word) {
				editLyricLines((state) => {
					const targetWord = state.lyricLines[lineIndex]?.words[wordIndex];
					if (!targetWord) return;
					targetWord.word = parsedWord;
					delete targetWord.splitUnsure;
				});
			}
		},
		[editLyricLines, lineIndex, word.word, wordIndex],
	);

	return editing ? (
		<div className={className}>
			<span className={styles.wordEditRow}>
				<AutoSizeTextField
					autoFocus
					value={editingValue}
					style={{ minWidth: "2ch" }}
					onChange={(evt) => setEditingValue(evt.currentTarget.value)}
					onBlur={onEnter}
					onKeyDown={(evt) => {
						if (evt.key === "Enter") onEnter(evt);
						if (evt.key === "Escape") {
							evt.preventDefault();
							evt.stopPropagation();
							editCancelledRef.current = true;
							setEditing(false);
						}
					}}
				/>
			</span>
		</div>
	) : (
		<ContextMenu.Root
			onOpenChange={(open) => {
				if (!open) return;
				const currentStore = store;
				const currentSelectedWords = currentStore.get(selectedWordsAtom);
				if (currentSelectedWords.has(word.id)) return;
				setSelectedWords((state) => {
					state.clear();
					state.add(word.id);
				});
				setSelectedLines((state) => {
					state.clear();
					state.add(line.id);
				});
			}}
		>
			<ContextMenu.Trigger>
				<LyricWordViewEditSpan
					wordAtom={wordAtom}
					wordIndex={wordIndex}
					className={className}
					line={line}
					style={
						useCompactSpace
							? ({ "--space-count": word.word.length } as React.CSSProperties)
							: undefined
					}
					onDoubleClick={(evt) => {
						if (evt.ctrlKey || evt.metaKey) {
							setSplitState({
								wordIndex,
								lineIndex,
								word: word.word,
							});
							setOpenSplitWordDialog(true);
							return;
						}
						setEditing(true);
					}}
				>
					<span className={styles.wordEditRow}>
						<div className={styles.wordMainContainer}>
							<div
								className={styles.wordMainText}
								title={spaceLabel ?? unsureLabel}
								aria-label={spaceLabel}
								aria-description={unsureLabel}
							>
								{useCompactSpace ? null : displayWord}
							</div>
						</div>
					</span>
				</LyricWordViewEditSpan>
			</ContextMenu.Trigger>
			<ContextMenu.Content
				onPointerDown={(evt) => evt.stopPropagation()}
				onClick={(evt) => evt.stopPropagation()}
			>
				<LyricWordMenu
					wordAtom={wordAtom}
					wordIndex={wordIndex}
					lineIndex={lineIndex}
				/>
				<LyricLineMenu lineIndex={lineIndex} />
			</ContextMenu.Content>
		</ContextMenu.Root>
	);
};
