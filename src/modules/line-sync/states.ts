import { atom } from "jotai";
import { syncLevelModeAtom } from "$/modules/settings/states/sync";
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
 * The sync level the lyric views should follow: Line mode treats every line as
 * one unit, the same way the old "Sync by: Line" pass selects whole lines.
 */
export const effectiveSyncLevelAtom = atom((get) =>
	get(lineSyncActiveAtom) ? "line" : get(syncLevelModeAtom),
);
