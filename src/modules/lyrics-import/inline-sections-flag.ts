import { atomWithStorage } from "jotai/utils";

/**
 * Experimental: list the detected sections next to the import text and edit
 * them there, instead of the separate Review sections step. Off by default.
 */
export const importInlineSectionsEnabledAtom = atomWithStorage(
	"importLyrics.inlineSections",
	false,
	undefined,
	{ getOnInit: true },
);
