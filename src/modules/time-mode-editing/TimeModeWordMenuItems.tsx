import { ContextMenu } from "@radix-ui/themes";
import { atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { replaceWordDialogAtom, splitWordDialogAtom } from "$/states/dialogs";
import {
	editingWordStateAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import {
	type CombineDirection,
	combineWithNeighbor,
	getNeighborRange,
} from "./combine-neighbors";
import { timeModeWordEditingEnabledAtom } from "./states";

/**
 * Split, combine and replace for the word selected in Time mode. Rendered in
 * the line context menu; renders nothing while the flag is off.
 */
export function TimeModeWordMenuItems({ lineIndex }: { lineIndex: number }) {
	const enabled = useAtomValue(timeModeWordEditingEnabledAtom);
	if (!enabled) return null;
	return <WordMenuItems lineIndex={lineIndex} />;
}

function WordMenuItems({ lineIndex }: { lineIndex: number }) {
	const { t } = useTranslation();
	const store = useStore();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setEditingWordState = useSetAtom(editingWordStateAtom);
	const setOpenSplitWordDialog = useSetAtom(splitWordDialogAtom);
	const setOpenReplaceWordDialog = useSetAtom(replaceWordDialogAtom);

	// The single selected word, when it belongs to this line.
	const targetAtom = useMemo(
		() =>
			atom((get) => {
				const selected = get(selectedWordsAtom);
				if (selected.size !== 1) return null;
				const line = get(lyricLinesAtom).lyricLines[lineIndex];
				if (!line) return null;
				const [id] = selected;
				const wordIndex = line.words.findIndex((word) => word.id === id);
				if (wordIndex === -1) return null;
				return {
					wordIndex,
					word: line.words[wordIndex].word,
					hasPrevious: !!getNeighborRange(line.words, wordIndex, "previous"),
					hasNext: !!getNeighborRange(line.words, wordIndex, "next"),
				};
			}),
		[lineIndex],
	);
	const target = useAtomValue(targetAtom);

	const openDialog = (open: (value: boolean) => void) => {
		if (!target) return;
		setEditingWordState({
			lineIndex,
			wordIndex: target.wordIndex,
			word: target.word,
		});
		open(true);
	};

	const combine = (direction: CombineDirection) => {
		if (!target) return;
		let combinedId: string | null = null;
		editLyricLines((state) => {
			const line = state.lyricLines[lineIndex];
			if (!line) return;
			const result = combineWithNeighbor(
				line.words,
				target.wordIndex,
				direction,
			);
			if (!result) return;
			line.words = result.words;
			combinedId = result.combined.id;
		});
		// Keep the sync cursor on the combined word so F, G and H carry on.
		if (combinedId) {
			const line = store.get(lyricLinesAtom).lyricLines[lineIndex];
			if (line) store.set(selectedLinesAtom, new Set([line.id]));
			store.set(selectedWordsAtom, new Set([combinedId]));
		}
	};

	return (
		<>
			<ContextMenu.Item
				disabled={!target}
				onSelect={() => openDialog(setOpenSplitWordDialog)}
			>
				{t("contextMenu.splitWord", "Split word...")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!target?.hasPrevious}
				onSelect={() => combine("previous")}
			>
				{t("timeModeEditing.combinePrevious", "Combine with previous word")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!target?.hasNext}
				onSelect={() => combine("next")}
			>
				{t("timeModeEditing.combineNext", "Combine with next word")}
			</ContextMenu.Item>
			<ContextMenu.Item
				disabled={!target}
				onSelect={() => openDialog(setOpenReplaceWordDialog)}
			>
				{t("contextMenu.replaceWord", "Replace word...")}
			</ContextMenu.Item>
			<ContextMenu.Separator />
		</>
	);
}
