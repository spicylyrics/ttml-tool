import { TextField } from "@radix-ui/themes";
import { newLyricWord } from "$/types/ttml.ts";
import styles from "../index.module.css";
import type { LyricLineViewState } from "./use-line-view";

/**
 * Line timing's Edit-mode row: the line is one block of text, so it is edited
 * as one field instead of a word chip that could be deleted on its own.
 * Clearing the field empties the line, like any empty line.
 */
export function LineTextField({
	line,
	lineIndex,
	editLyricLines,
	t,
}: Pick<LyricLineViewState, "line" | "lineIndex" | "editLyricLines" | "t">) {
	const text = line.words.map((word) => word.word).join("");

	const commit = (value: string) => {
		const next = value.trim();
		if (next === text.trim()) return;
		editLyricLines((state) => {
			const target = state.lyricLines[lineIndex];
			if (!next) {
				target.words = [];
			} else if (target.words[0]) {
				target.words[0].word = next;
			} else {
				target.words = [
					{
						...newLyricWord(),
						word: next,
						startTime: target.startTime,
						endTime: target.endTime,
					},
				];
			}
		});
	};

	return (
		<TextField.Root
			// Remount when the text changes elsewhere (undo, Edit as text).
			key={text}
			defaultValue={text}
			className={styles.lineTextField}
			placeholder={t("lineSync.lineText", "Line text")}
			aria-label={t("lineSync.lineText", "Line text")}
			onBlur={(evt) => commit(evt.currentTarget.value)}
			onKeyDown={(evt) => {
				if (evt.key === "Enter") {
					evt.preventDefault();
					evt.stopPropagation();
					commit(evt.currentTarget.value);
					evt.currentTarget.blur();
				} else if (evt.key === "Escape") {
					evt.stopPropagation();
					evt.currentTarget.value = text;
					evt.currentTarget.blur();
				}
			}}
		/>
	);
}
