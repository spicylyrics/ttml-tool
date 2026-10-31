import { StateEffect, StateField } from "@codemirror/state";
import { Decoration, type DecorationSet, EditorView } from "@codemirror/view";
import { atom } from "jotai";

/** Ask a lyric editor to open its search, from outside it (a shortcut or the palette). */
export interface LyricSearchRequest {
	mode: "find" | "replace";
	text?: string;
	id: number;
}

export const lyricSearchRequestAtom = atom<LyricSearchRequest | null>(null);

let mountedEditors = 0;
/** Whether a lyric editor is on screen to take a search request. */
export const lyricEditorMounted = () => mountedEditors > 0;
export function trackMountedEditor() {
	mountedEditors++;
	return () => {
		mountedEditors--;
	};
}

export const setSearchHighlights = StateEffect.define<{
	ranges: { from: number; to: number }[];
	current: number;
}>();

const match = Decoration.mark({ class: "lm-match" });
const currentMatch = Decoration.mark({ class: "lm-match lm-current" });

/** Marks every search match, and the current one more strongly. */
export const searchHighlightField = StateField.define<DecorationSet>({
	create: () => Decoration.none,
	update(decorations, transaction) {
		let next = decorations.map(transaction.changes);
		for (const effect of transaction.effects) {
			if (!effect.is(setSearchHighlights)) continue;
			next = Decoration.set(
				effect.value.ranges.map((range, index) =>
					(index === effect.value.current ? currentMatch : match).range(
						range.from,
						range.to,
					),
				),
			);
		}
		return next;
	},
	provide: (field) => EditorView.decorations.from(field),
});
