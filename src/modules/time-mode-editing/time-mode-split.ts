import type { createStore } from "jotai";
import { currentTimeAtom } from "$/modules/audio/states";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import type { LyricWord } from "$/types/ttml";
import { applyPlayheadSplit } from "./split-timing";

type Store = ReturnType<typeof createStore>;

/**
 * Time-mode extras for the Split word dialog: the dialog's own target word is
 * split at the playhead when it falls inside the word, and the first new word
 * stays selected so F, G and H carry on. Null (no change) outside Time mode.
 */
export function createTimeModeSplit(
	store: Store,
	target: { lineIndex: number; wordIndex: number },
) {
	if (store.get(toolModeAtom) !== ToolMode.Sync) return null;

	const line = store.get(lyricLinesAtom).lyricLines[target.lineIndex];
	const targetId = line?.words[target.wordIndex]?.id;
	if (!line || !targetId) return null;
	const playheadMs = store.get(currentTimeAtom);
	let firstPartId: string | null = null;

	return {
		adjust(word: LyricWord, parts: LyricWord[]): LyricWord[] {
			if (word.id !== targetId) return parts;
			const result = applyPlayheadSplit(word, parts, playheadMs);
			firstPartId = result[0]?.id ?? null;
			return result;
		},
		reselect() {
			if (!firstPartId) return;
			store.set(selectedLinesAtom, new Set([line.id]));
			store.set(selectedWordsAtom, new Set([firstPartId]));
		},
	};
}
