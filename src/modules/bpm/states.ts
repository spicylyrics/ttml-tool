import { atomWithStorage } from "jotai/utils";

/** Feature flag: show the estimated tempo in the Time ribbon. Off by default. */
export const bpmDisplayEnabledAtom = atomWithStorage(
	"bpmDisplayEnabled",
	false,
);
