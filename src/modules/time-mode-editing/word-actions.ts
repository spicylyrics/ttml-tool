import { atom, type createStore } from "jotai";
import { replaceWordDialogAtom, splitWordDialogAtom } from "$/states/dialogs";
import {
	editingWordStateAtom,
	lyricLinesAtom,
	selectedWordsAtom,
} from "$/states/main";

type Store = ReturnType<typeof createStore>;

export interface SelectedWordTarget {
	lineIndex: number;
	wordIndex: number;
	word: string;
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
		};
	}
	return null;
});

export const hasSelectedWordAtom = atom(
	(get) => get(selectedWordTargetAtom) !== null,
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
