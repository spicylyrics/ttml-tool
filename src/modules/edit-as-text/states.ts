import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/** Feature flag for Edit > Edit as text. Off by default. */
export const editAsTextEnabledAtom = atomWithStorage(
	"editAsText.enabled",
	false,
	undefined,
	{ getOnInit: true },
);

export const editAsTextDialogAtom = atom(false);
