import { atom } from "jotai";
import { lyricLinesAtom } from "$/states/main";
import { getTimingMode } from "./timing-mode";

/** The open song's timing mode; a primitive, so readers skip word edits. */
export const songTimingModeAtom = atom((get) =>
	getTimingMode(get(lyricLinesAtom)),
);

/** True while the open song is in Line mode. */
export const lineSyncActiveAtom = atom(
	(get) => get(songTimingModeAtom) === "line",
);

/**
 * What the lyric views select and highlight as one unit: whole lines in Line
 * mode, words otherwise.
 */
export const effectiveSyncLevelAtom = atom((get) =>
	get(lineSyncActiveAtom) ? "line" : "word",
);

/** Open while Line → Word asks how to time the new words. */
export const switchToWordDialogAtom = atom(false);
