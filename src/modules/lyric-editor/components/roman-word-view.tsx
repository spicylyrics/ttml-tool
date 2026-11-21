import { Button } from "@radix-ui/themes";
import classNames from "classnames";
import { type Atom, useAtom, useAtomValue, type WritableAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useRef,
	useState,
} from "react";
import { lyricLinesAtom } from "$/states/main";
import type { LyricWord } from "$/types/ttml";
import { AutoSizeTextField } from "../tools/AutoSizeTextField.tsx";
import styles from "./roman-word-view.module.css";

interface RomanWordViewProps {
	wordAtom: Atom<LyricWord>;
	wordIndex: number;
	editingIndexAtom: WritableAtom<number | null, [number | null], void>;
}

export const RomanWordView = ({
	wordAtom,
	wordIndex,
	editingIndexAtom,
}: RomanWordViewProps) => {
	const word = useAtomValue(wordAtom);
	const [editingIndex, setEditingIndex] = useAtom(editingIndexAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [inputValue, setInputValue] = useState(word.romanWord);
	const inputRef = useRef<HTMLInputElement>(null);

	const isEditing = editingIndex === wordIndex;
	// Escape unmounts the input, and the resulting blur must not commit.
	const cancelledRef = useRef(false);

	const saveAndStopEditing = useCallback(
		(newValue: string) => {
			if (cancelledRef.current) return;
			if (newValue !== word.romanWord) {
				editLyricLines((draft) => {
					for (const line of draft.lyricLines) {
						const targetWord = line.words.find((w) => w.id === word.id);
						if (targetWord) {
							targetWord.romanWord = newValue;
							break;
						}
					}
				});
			}
			setEditingIndex(null);
		},
		[word.id, word.romanWord, editLyricLines, setEditingIndex],
	);

	useEffect(() => {
		if (isEditing) {
			setInputValue(word.romanWord || "");
		}
	}, [isEditing, word.romanWord]);

	useEffect(() => {
		if (isEditing) {
			cancelledRef.current = false;
			inputRef.current?.focus();
			inputRef.current?.select();
		}
	}, [isEditing]);

	const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
		if (e.nativeEvent.isComposing) return;
		const value = e.currentTarget.value;
		switch (e.key) {
			case "Enter":
			case "Tab":
				e.preventDefault();
				saveAndStopEditing(value);
				// Shift+Tab goes back; the first word has nowhere earlier to go.
				setEditingIndex(
					e.shiftKey && e.key === "Tab"
						? wordIndex > 0
							? wordIndex - 1
							: null
						: wordIndex + 1,
				);
				break;
			case "Escape":
				e.preventDefault();
				e.stopPropagation();
				cancelledRef.current = true;
				setEditingIndex(null);
				break;
			case "Backspace":
				if (value === "") {
					e.preventDefault();
					saveAndStopEditing("");
					setEditingIndex(wordIndex - 1);
				}
				break;
			default:
				break;
		}
	};

	if (isEditing) {
		return (
			<AutoSizeTextField
				inputRef={inputRef}
				size="1"
				data-lyric-line-interactive=""
				data-word-romanization-editor=""
				className={styles.romanWordInput}
				style={{ minWidth: "2ch" }}
				value={inputValue}
				onChange={(e) => setInputValue(e.currentTarget.value)}
				onBlur={(e) => saveAndStopEditing(e.currentTarget.value)}
				onKeyDown={handleKeyDown}
			/>
		);
	}

	return (
		<Button
			size="1"
			variant="soft"
			color="gray"
			data-lyric-line-interactive=""
			data-word-romanization-editor=""
			className={classNames(
				styles.romanWordView,
				!word.romanWord && styles.placeholder,
			)}
			onClick={(e) => {
				e.stopPropagation();
				setEditingIndex(wordIndex);
			}}
		>
			{word.romanWord || ""}
		</Button>
	);
};
