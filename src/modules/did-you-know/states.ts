import { atomWithStorage } from "jotai/utils";
import type { HintId } from "./detectors";

/**
 * Off until there are more than a couple of tips to show. While off, no tip
 * shows and the setting is hidden; the stored choices are left alone.
 */
export const TIPS_RELEASED = false;

/** The "Show tips" setting; "Don't show tips" on a tip turns it off. */
export const didYouKnowEnabledAtom = atomWithStorage(
	"didYouKnowHintsEnabled",
	true,
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
