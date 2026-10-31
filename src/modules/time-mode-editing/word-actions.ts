import { atom, type createStore } from "jotai";
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

type Store = ReturnType<typeof createStore>;

export interface SelectedWordTarget {
	lineIndex: number;
	wordIndex: number;
	word: string;
	hasPrevious: boolean;
	hasNext: boolean;
}

/** The one selected word (the Time-mode sync cursor), or null. */
export const selectedWordTargetAtom = atom((get): SelectedWordTarget | null => {
	const selected = get(selectedWordsAtom);
	if (selected.size !== 1) return null;
	const [id] = selected;
	const lines = get(lyricLinesAtom).lyricLines;
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const words = lines[lineIndex].words;
		const wordIndex = words.findIndex((word) => word.id === id);
		if (wordIndex === -1) continue;
		return {
			lineIndex,
			wordIndex,
			word: words[wordIndex].word,
			hasPrevious: !!getNeighborRange(words, wordIndex, "previous"),
			hasNext: !!getNeighborRange(words, wordIndex, "next"),
		};
	}
	return null;
});

export const hasSelectedWordAtom = atom(
	(get) => get(selectedWordTargetAtom) !== null,
);
export const canCombinePreviousAtom = atom(
	(get) => get(selectedWordTargetAtom)?.hasPrevious ?? false,
);
export const canCombineNextAtom = atom(
	(get) => get(selectedWordTargetAtom)?.hasNext ?? false,
);

function openWordDialog(store: Store, dialog: typeof splitWordDialogAtom) {
	const target = store.get(selectedWordTargetAtom);
	if (!target) return;
	store.set(editingWordStateAtom, {
		lineIndex: target.lineIndex,
		wordIndex: target.wordIndex,
		word: target.word,
	});
	store.set(dialog, true);
}

/** Opens Split word for the selected word; in Time mode it splits at the playhead. */
export const openSplitSelectedWord = (store: Store) =>
	openWordDialog(store, splitWordDialogAtom);

/** Opens Replace word for the selected word. */
export const openReplaceSelectedWord = (store: Store) =>
	openWordDialog(store, replaceWordDialogAtom);

/**
 * Combines the selected word with its previous or next word and keeps the
 * combined word selected, so F, G and H carry on from it.
 */
export function combineSelectedWord(store: Store, direction: CombineDirection) {
	const target = store.get(selectedWordTargetAtom);
	if (!target) return;
	const document = store.get(lyricLinesAtom);
	const line = document.lyricLines[target.lineIndex];
	const result = combineWithNeighbor(line.words, target.wordIndex, direction);
	if (!result) return;
	store.set(lyricLinesAtom, {
		...document,
		lyricLines: document.lyricLines.map((other, index) =>
			index === target.lineIndex ? { ...line, words: result.words } : other,
		),
	});
	store.set(selectedLinesAtom, new Set([line.id]));
	store.set(selectedWordsAtom, new Set([result.combined.id]));
}
