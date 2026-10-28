import { atomWithStorage } from "jotai/utils";

/**
 * Experimental: the keyboard view in Preferences › Shortcuts and second keys
 * for an action. While off, extra keys are neither shown nor dispatched.
 */
export const keyboardViewEnabledAtom = atomWithStorage(
	"keyboardView.enabled",
	false,
	undefined,
	{ getOnInit: true },
);
