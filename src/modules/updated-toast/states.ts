import { atomWithStorage } from "jotai/utils";

/** Feature flag: show "Updated to vX.Y.Z" after the app updates. Off by default. */
export const updatedToastEnabledAtom = atomWithStorage(
	"updatedToastEnabled",
	false,
	undefined,
	{ getOnInit: true },
);
