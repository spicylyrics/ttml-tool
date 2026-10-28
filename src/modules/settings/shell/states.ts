import { atomWithStorage } from "jotai/utils";

/**
 * Opens Preferences in the new shell (search on top, wrapping sidebar) instead
 * of the classic dialog. Off by default while the pages are reorganized.
 */
export const preferencesShellEnabledAtom = atomWithStorage(
	"preferencesShellEnabled",
	false,
);
