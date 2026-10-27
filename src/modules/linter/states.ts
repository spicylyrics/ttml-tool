import { atom, type getDefaultStore } from "jotai";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentTimeAtom } from "$/modules/audio/states";
import {
	allowConsecutiveBackgroundLinesAtom,
	lyricTextNormalizationOptionsAtom,
} from "$/modules/settings/states";
import { selectedLinesAtom, selectedWordsAtom } from "$/states/main";
import type { LintOptions, LyricLintResult } from "./lint";

type Store = ReturnType<typeof getDefaultStore>;

export const problemsDialogAtom = atom(false);

/** Latest live result; null until the first debounced run. */
export const lintResultAtom = atom<LyricLintResult | null>(null);

/** The same writer options a save uses, so the lint matches the export. */
export const lintOptionsAtom = atom<LintOptions>((get) => ({
	normalization: get(lyricTextNormalizationOptionsAtom),
	allowConsecutiveBackgroundLines: get(allowConsecutiveBackgroundLinesAtom),
}));

/** Selects a line (and words), and moves playback to it. */
export function focusLyric(
	store: Store,
	target: { lineId?: string; wordIds?: string[]; timeMs?: number },
) {
	if (target.lineId) store.set(selectedLinesAtom, new Set([target.lineId]));
	store.set(selectedWordsAtom, new Set(target.wordIds ?? []));
	if (target.timeMs != null) {
		audioEngine.seekMusic(target.timeMs / 1000);
		store.set(currentTimeAtom, target.timeMs);
	}
}
