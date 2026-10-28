import { atomWithStorage } from "jotai/utils";

/**
 * Opt-in Edit mode tools: swap main and duet lines, split a typed line into
 * words, and reopen a project where Edit mode was left. Off by default.
 */
export const editModeToolsAtom = atomWithStorage(
	"lyricEditor.editModeTools",
	false,
	undefined,
	{ getOnInit: true },
);
