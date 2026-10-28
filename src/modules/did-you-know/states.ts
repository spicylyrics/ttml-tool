import { atomWithStorage } from "jotai/utils";
import type { HintId } from "./detectors";

/** Feature flag and the "Don't show tips" switch in one. Off by default. */
export const didYouKnowEnabledAtom = atomWithStorage(
	"didYouKnowHintsEnabled",
	false,
	undefined,
	{ getOnInit: true },
);

/** Hints that have already shown once; they never show again. */
export const didYouKnowShownAtom = atomWithStorage<HintId[]>(
	"didYouKnowShownHints",
	[],
	undefined,
	{ getOnInit: true },
);
