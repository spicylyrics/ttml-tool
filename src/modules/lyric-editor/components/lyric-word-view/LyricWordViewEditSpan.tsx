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

import { type Atom, atom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type MouseEvent,
	type PropsWithChildren,
	useMemo,
	useRef,
} from "react";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main.ts";
import { type LyricLine, type LyricWord, newLyricWord } from "$/types/ttml.ts";
import { normalizeLineTime } from "../../utils/normalize-line-time.ts";
import styles from "../index.module.css";
import { isDraggingAtom } from "./states";

type LyricWordViewEditSpanProps = {
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	line: LyricLine;
	className?: string;
	onDoubleClick?: (evt: MouseEvent<HTMLSpanElement>) => void;
};

export const LyricWordViewEditSpan = ({
	wordAtom,
	wordIndex,
	line,
	className,
	children,
	onDoubleClick,
	...props
}: PropsWithChildren<
	LyricWordViewEditSpanProps & React.HTMLAttributes<HTMLSpanElement>
>) => {
	const word = useAtomValue(wordAtom);
	const store = useStore();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setSelectedLines = useSetImmerAtom(selectedLinesAtom);
	const isWordSelectedAtom = useMemo(
		() => atom((get) => get(selectedWordsAtom).has(get(wordAtom).id)),
		[wordAtom],
	);
	const isWordSelected = useAtomValue(isWordSelectedAtom);
	const selectedWords = useAtomValue(selectedWordsAtom);
	const setSelectedWords = useSetImmerAtom(selectedWordsAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const blockDragRef = useRef(false);
	const lastClickTimeRef = useRef(0);

	function onWordSelect(evt: MouseEvent<HTMLSpanElement>) {
		if (evt.ctrlKey || evt.metaKey) {
			setSelectedWords((v) => {
				if (v.has(word.id)) {
					v.delete(word.id);
				} else {
					v.add(word.id);
				}
			});
		} else if (evt.shiftKey) {
			setSelectedWords((v) => {
				if (v.size > 0) {
					let minBoundry = Number.NaN;
					let maxBoundry = Number.NaN;
					line.words.forEach((word, i) => {
						if (v.has(word.id)) {
							if (Number.isNaN(minBoundry)) minBoundry = i;
							if (Number.isNaN(maxBoundry)) maxBoundry = i;

							minBoundry = Math.min(minBoundry, i, wordIndex);
							maxBoundry = Math.max(maxBoundry, i, wordIndex);
						}
					});
					for (let i = minBoundry; i <= maxBoundry; i++) {
						v.add(line.words[i].id);
					}
				} else {
					v.add(word.id);
				}
			});
		} else {
			setSelectedLines((state) => {
				if (!state.has(line.id) || state.size !== 1) {
					state.clear();
					state.add(line.id);
				}
			});
			setSelectedWords((state) => {
				if (!state.has(word.id) || state.size !== 1) {
					state.clear();
					state.add(word.id);
				}
			});
		}
	}

	return (
		<span
			{...props}
			data-lyric-word-interactive=""
			draggable={toolMode === ToolMode.Edit}
			onPointerDown={(evt) => {
				blockDragRef.current =
					(evt.target as HTMLElement | null)?.tagName === "INPUT";
			}}
			onPointerUp={() => {
				blockDragRef.current = false;
			}}
			onDragStart={(evt) => {
				if (blockDragRef.current) {
					blockDragRef.current = false;
					evt.preventDefault();
					evt.stopPropagation();
					return;
				}
				if (!isWordSelected) onWordSelect(evt);
				evt.dataTransfer.effectAllowed = "copyMove";
				evt.dataTransfer.dropEffect = "move";
				store.set(isDraggingAtom, true);
				evt.stopPropagation();
			}}
			onDragEnd={() => {
				store.set(isDraggingAtom, false);
				blockDragRef.current = false;
			}}
			onDragOver={(evt) => {
				if (!store.get(isDraggingAtom)) return;
				if (isWordSelected) return;
				evt.preventDefault();
				evt.dataTransfer.dropEffect = "move";
				const rect = evt.currentTarget.getBoundingClientRect();
				const innerX = evt.clientX - rect.left;
				if (innerX < rect.width / 2) {
					evt.currentTarget.classList.add(styles.dropLeft);
					evt.currentTarget.classList.remove(styles.dropRight);
				} else {
					evt.currentTarget.classList.remove(styles.dropLeft);
					evt.currentTarget.classList.add(styles.dropRight);
				}
				const isCopyingWords = evt.ctrlKey || evt.metaKey;
				evt.dataTransfer.dropEffect = isCopyingWords ? "copy" : "move";
			}}
			onDrop={(evt) => {
				evt.currentTarget.classList.remove(styles.dropLeft);
				evt.currentTarget.classList.remove(styles.dropRight);
				if (!store.get(isDraggingAtom)) return;
				if (isWordSelected) return;

				const rect = evt.currentTarget.getBoundingClientRect();
				const innerX = evt.clientX - rect.left;
				const insertRight = innerX > rect.width / 2;

				const isCopyingWords = evt.ctrlKey || evt.metaKey;
				editLyricLines((state) => {
					let collectedWords: LyricWord[] = [];
					for (const line of state.lyricLines) {
						const words = line.words.filter((w) => selectedWords.has(w.id));
						collectedWords.push(...words);
						if (!isCopyingWords) {
							const deletedAtBounds =
								line.words.length > 0 &&
								(selectedWords.has(line.words[0].id) ||
									selectedWords.has(line.words[line.words.length - 1].id));
							line.words = line.words.filter((w) => !selectedWords.has(w.id));
							if (deletedAtBounds) normalizeLineTime(line);
						}
					}
					const targetLine = state.lyricLines.find(({ id }) => id === line.id);
					if (!targetLine) throw new Error("Target line not found");
					const targetIndex = targetLine.words.findIndex(
						(w) => w.id === word.id,
					);
					if (targetIndex < 0) throw new Error("Target word not found");
					if (isCopyingWords) {
						collectedWords = collectedWords.map((w) => ({
							...w,
							id: newLyricWord().id,
						}));
						setSelectedWords((v) => {
							v.clear();
							for (const w of collectedWords) {
								v.add(w.id);
							}
						});
					}
					const insertPosition = targetIndex + (insertRight ? 1 : 0);
					const insertedAtBounds =
						insertPosition === 0 || insertPosition === targetLine.words.length;
					targetLine.words.splice(insertPosition, 0, ...collectedWords);
					if (insertedAtBounds) normalizeLineTime(targetLine);
				});
			}}
			onDragLeave={(evt) => {
				// Crossing onto a child inside the chip also fires dragleave; keep
				// the marker, or it flashes off and on as the pointer moves.
				if (evt.currentTarget.contains(evt.relatedTarget as Node | null))
					return;
				evt.currentTarget.classList.remove(styles.dropLeft);
				evt.currentTarget.classList.remove(styles.dropRight);
			}}
			className={className}
			onClick={(evt) => {
				const now = Date.now();
				const wasAlreadySelected = isWordSelected && selectedWords.size === 1;
				const isSelectionClick = !evt.ctrlKey && !evt.metaKey && !evt.shiftKey;
				const clickInterval = now - lastClickTimeRef.current;
				lastClickTimeRef.current = now;

				evt.stopPropagation();
				evt.preventDefault();

				if ((evt.ctrlKey || evt.metaKey) && evt.detail === 2) {
					setSelectedLines((state) => {
						state.clear();
						state.add(line.id);
					});
					setSelectedWords((state) => {
						state.clear();
						state.add(word.id);
					});
					onDoubleClick?.(evt);
					return;
				}

				onWordSelect(evt);

				if (wasAlreadySelected && isSelectionClick && clickInterval > 100) {
					onDoubleClick?.(evt);
				}
			}}
		>
			{children}
		</span>
	);
};
