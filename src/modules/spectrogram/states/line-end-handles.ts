import { atomWithStorage } from "jotai/utils";

/**
 * Feature flag: one handle where a line and its last word end together, and
 * distinct, easier-to-grab handles where they don't.
 */
export const spectrogramLineEndHandlesAtom = atomWithStorage<boolean>(
	"spectrogramLineEndHandles",
	false,
);
