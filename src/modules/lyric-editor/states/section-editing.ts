import { atomWithStorage } from "jotai/utils";

/**
 * Feature flag for the reworked section tools: clickable headers, Start
 * section here, moving a section's start, Apply timings from... and reading
 * `itunes:song-part` when opening a TTML. Off keeps the old behavior.
 */
export const sectionEditingEnabledAtom = atomWithStorage<boolean>(
	"sectionEditingEnabled",
	false,
);
