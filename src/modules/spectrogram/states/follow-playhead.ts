import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { FollowMode } from "../utils/follow-playhead";

export type FollowStyle = Exclude<FollowMode, "off">;

/** Feature flag: shows the follow toggle and lets the spectrogram follow the playhead. */
export const spectrogramFollowFeatureAtom = atomWithStorage(
	"settings_spectrogramFollowFeature",
	false,
);

/** The toolbar toggle and its shortcut flip this. */
export const spectrogramFollowOnAtom = atomWithStorage(
	"settings_spectrogramFollowOn",
	true,
);

export const spectrogramFollowStyleAtom = atomWithStorage<FollowStyle>(
	"settings_spectrogramFollowStyle",
	"page",
);

export const spectrogramFollowModeAtom = atom<FollowMode>((get) =>
	get(spectrogramFollowFeatureAtom) && get(spectrogramFollowOnAtom)
		? get(spectrogramFollowStyleAtom)
		: "off",
);
