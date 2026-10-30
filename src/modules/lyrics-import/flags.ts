import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * Feature flag: the "Split now" / "I'll split later" choice on the import
 * screen. Off by default; with it off the screen works as before.
 */
export const importSplitChoiceEnabledAtom = atomWithStorage(
	"importLyrics.splitChoice",
	false,
	undefined,
	{ getOnInit: true },
);

export type ImportSplitMode = "now" | "later";

/** The choice for the current import. Reset to "later" each time the screen opens. */
export const importSplitModeAtom = atom<ImportSplitMode>("later");
