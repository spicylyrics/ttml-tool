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
import { Flex, IconButton, TextField } from "@radix-ui/themes";
import classNames from "classnames";
import { atom, useAtomValue } from "jotai";
import { Fragment } from "react";
import { segmentationLearnedRulesAtom } from "$/modules/segmentation/states";
import { ToolMode } from "$/states/main.ts";
import { newLyricWord } from "$/types/ttml.ts";
import { splitTypedLinesAtom } from "../../states/edit-mode-tools.ts";
import { typedLineToWords } from "../../utils/typed-line-words.ts";
import { getWordConnections } from "../../utils/word-connections.ts";
import styles from "../index.module.css";
import LyricWordView from "../lyric-word-view.tsx";
import { RomanWordView } from "../roman-word-view.tsx";
import type { LyricLineViewState } from "./use-line-view";

// Read only while the flag is on, so rows don't subscribe to learned splits otherwise.
const noLearnedRulesAtom = atom(new Map<string, number[]>());

export function LineWordRow({
	lineIndex,
	t,
	line,
	words,
	toolMode,
	editLyricLines,
	showTimestamps,
	store,
	activeGeniusHeader,
	customHeaderColor,
	isSectionStart,
	categoryColor,
	wordsContainerRef,
	showWordRomanizationInput,
	wordTexts,
	editingRomanWordIndexAtom,
	legacySpaceLabels,
	syncWordWrap,
	enableInsert,
}: Pick<
	LyricLineViewState,
	| "lineIndex"
	| "t"
	| "line"
	| "words"
	| "toolMode"
	| "editLyricLines"
	| "showTimestamps"
	| "store"
	| "activeGeniusHeader"
	| "customHeaderColor"
	| "isSectionStart"
	| "categoryColor"
	| "wordsContainerRef"
	| "showWordRomanizationInput"
	| "wordTexts"
	| "editingRomanWordIndexAtom"
	| "legacySpaceLabels"
	| "syncWordWrap"
	| "enableInsert"
>) {
	const splitTypedLine = useAtomValue(splitTypedLinesAtom);
	const learnedRules = useAtomValue(
		splitTypedLine ? segmentationLearnedRulesAtom : noLearnedRulesAtom,
	);
	return (
		<div
			className={classNames(
				styles.lyricWordsContainer,
				toolMode === ToolMode.Edit && styles.edit,
				toolMode === ToolMode.Sync && styles.sync,
				toolMode === ToolMode.Sync && syncWordWrap && styles.wrap,
				!showTimestamps && styles.hideTimestamps,
			)}
			ref={wordsContainerRef}
			style={{
				backgroundColor: activeGeniusHeader
					? customHeaderColor
						? `${customHeaderColor}15` // 15 is roughly 8% opacity
						: `var(--${categoryColor}-2)`
					: undefined,
				borderLeft: activeGeniusHeader
					? `2px solid ${customHeaderColor || `var(--${categoryColor}-9)`}`
					: undefined,
				borderRadius: isSectionStart ? "var(--radius-2)" : "0",
				padding: activeGeniusHeader ? "4px 8px" : undefined,
			}}
		>
			{words.map((wordAtom, wi) => {
				const word = store.get(wordAtom);
				const connections = getWordConnections(wordTexts, wi);
				return (
					<Fragment key={`word-${word.id}`}>
						{enableInsert && (
							<IconButton
								size="1"
								variant="soft"
								onClick={(evt) => {
									evt.preventDefault();
									evt.stopPropagation();
									editLyricLines((state) => {
										state.lyricLines[lineIndex].words.splice(
											wi,
											0,
											newLyricWord(),
										);
									});
								}}
							>
								<AddFilled />
							</IconButton>
						)}
						<Flex
							direction="column"
							align="stretch"
							gap={showWordRomanizationInput ? "0" : "3"}
							data-word-index={wi}
							className={classNames(
								styles.wordGroup,
								!legacySpaceLabels &&
									word.word.length > 0 &&
									word.word.trim().length === 0 &&
									styles.spaceGroup,
								showWordRomanizationInput && styles.withRomanization,
								toolMode === ToolMode.Edit &&
									!enableInsert &&
									connections.previous &&
									styles.connectedPrevious,
								toolMode === ToolMode.Edit &&
									!enableInsert &&
									connections.next &&
									styles.connectedNext,
							)}
						>
							<LyricWordView
								wordAtom={wordAtom}
								wordIndex={wi}
								line={line}
								lineIndex={lineIndex}
								isHeaderLine={false}
							/>
							{toolMode === ToolMode.Edit && showWordRomanizationInput && (
								<RomanWordView
									wordAtom={wordAtom}
									wordIndex={wi}
									editingIndexAtom={editingRomanWordIndexAtom}
								/>
							)}
						</Flex>
					</Fragment>
				);
			})}
			{enableInsert && (
				<IconButton
					size="1"
					variant="soft"
					onClick={(evt) => {
						evt.preventDefault();
						evt.stopPropagation();
						editLyricLines((state) => {
							state.lyricLines[lineIndex].words.push(newLyricWord());
						});
					}}
				>
					<AddFilled />
				</IconButton>
			)}
			{toolMode === ToolMode.Edit && (
				<TextField.Root
					placeholder={t("lyricLineView.insertWord", "插入单词…")}
					className={classNames(
						styles.insertWordField,
						words.length === 0 && styles.empty,
					)}
					style={{
						alignSelf: "center",
					}}
					onKeyDown={(evt) => {
						if (evt.key === "Enter") {
							evt.preventDefault();
							evt.stopPropagation();
							const word = evt.currentTarget.value;
							editLyricLines((state) => {
								// Only a whole line typed into an empty line is split;
								// adding to a line that has words inserts one word.
								const typed =
									splitTypedLine &&
									state.lyricLines[lineIndex].words.length === 0
										? typedLineToWords(word, learnedRules)
										: [word];
								state.lyricLines[lineIndex].words.push(
									...typed.map((text) => ({ ...newLyricWord(), word: text })),
								);
							});
							evt.currentTarget.value = "";
						}
					}}
				/>
			)}
		</div>
	);
}
