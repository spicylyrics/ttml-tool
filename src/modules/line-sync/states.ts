import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { syncLevelModeAtom } from "$/modules/settings/states/sync";
import { lyricLinesAtom } from "$/states/main";
import { getTimingMode } from "./timing-mode";

/** Feature flag for per-song Word/Line timing. Off keeps today's behavior. */
export const lineSyncEnabledAtom = atomWithStorage(
	"lineSyncMode",
	false,
	undefined,
	{ getOnInit: true },
);

/** The open song's timing mode; a primitive, so readers skip word edits. */
export const songTimingModeAtom = atom((get) =>
	getTimingMode(get(lyricLinesAtom)),
);

/** True while the open song is in Line mode and the feature is on. */
export const lineSyncActiveAtom = atom(
	(get) => get(lineSyncEnabledAtom) && get(songTimingModeAtom) === "line",
);

/**
 * The sync level the lyric views should follow: Line mode treats every line as
 * one unit, the same way the old "Sync by: Line" pass selects whole lines.
 */
export const effectiveSyncLevelAtom = atom((get) =>
	get(lineSyncActiveAtom) ? "line" : get(syncLevelModeAtom),
);
