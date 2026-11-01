import { atom } from "jotai";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import type { LyricLine } from "$/types/ttml";

export interface UnsureSplitWord {
	lineId: string;
	wordId: string;
}

/**
 * The first part of every unsure split, in lyric order. A split's parts are
 * consecutive flagged words, so each split is listed once.
 */
export function findUnsureSplitWords(lines: LyricLine[]): UnsureSplitWord[] {
	return lines.flatMap((line) =>
		line.words
			.filter(
				(word, index) =>
					word.splitUnsure && !line.words[index - 1]?.splitUnsure,
			)
			.map((word) => ({ lineId: line.id, wordId: word.id })),
	);
}

/**
 * Clears the flag on the selected words and on the other parts of their
 * split, the flagged words directly before and after them.
 */
export function clearUnsureSplits(
	lines: LyricLine[],
	wordIds: ReadonlySet<string>,
): void {
	for (const line of lines) {
		const words = line.words;
		words.forEach((word, index) => {
			if (!wordIds.has(word.id) || !word.splitUnsure) return;
			let start = index;
			while (start > 0 && words[start - 1].splitUnsure) start--;
			let end = index;
			while (end < words.length - 1 && words[end + 1].splitUnsure) end++;
			for (let part = start; part <= end; part++)
				delete words[part].splitUnsure;
		});
	}
}

export const unsureSplitWordsAtom = atom((get) =>
	findUnsureSplitWords(get(lyricLinesAtom).lyricLines),
);

/** Selects the next unsure split after the current selection, in Edit mode. */
export const selectNextUnsureSplitAtom = atom(null, (get, set) => {
	const flagged = get(unsureSplitWordsAtom);
	if (flagged.length === 0) return false;
	const order = get(lyricLinesAtom).lyricLines.flatMap((line) =>
		line.words.map((word) => word.id),
	);
	const selected = get(selectedWordsAtom);
	const after = Math.max(-1, ...[...selected].map((id) => order.indexOf(id)));
	const next =
		flagged.find(({ wordId }) => order.indexOf(wordId) > after) ?? flagged[0];

	const line = get(lyricLinesAtom).lyricLines.find(
		(item) => item.id === next.lineId,
	);
	if (line?.sectionId) {
		const expanded = new Set(get(collapsedSectionIdsAtom));
		expanded.delete(line.sectionId);
		set(collapsedSectionIdsAtom, expanded);
	}
	set(selectedLinesAtom, new Set([next.lineId]));
	set(selectedWordsAtom, new Set([next.wordId]));
	set(toolModeAtom, ToolMode.Edit);
	return true;
});
