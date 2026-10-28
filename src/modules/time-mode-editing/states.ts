import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * Feature flag for split, combine and replace word in Time mode. Off keeps
 * Time mode exactly as it was.
 */
export const timeModeWordEditingEnabledAtom = atomWithStorage(
	"timeModeWordEditing",
	false,
	undefined,
	{ getOnInit: true },
);

/** With the flag on, double-clicking a word in Time mode edits its start time. */
export const timeModeDoubleClickTimestampAtom = atomWithStorage(
	"timeModeDoubleClickTimestamp",
	false,
	undefined,
	{ getOnInit: true },
);

/** True only while both the flag and the double-click preference are on. */
export const doubleClickEditsTimestampAtom = atom(
	(get) =>
		get(timeModeWordEditingEnabledAtom) &&
		get(timeModeDoubleClickTimestampAtom),
);
