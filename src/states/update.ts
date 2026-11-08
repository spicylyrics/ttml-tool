import { APP_VERSION } from "virtual:buildmeta";
import type { Update } from "@tauri-apps/plugin-updater";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { isBetaVersion } from "$/utils/version-label";

export type UpdateStatus =
	| "idle"
	| "checking"
	| "up-to-date"
	| "available"
	| "downloading"
	| "ready"
	| "error";

export const updateStatusAtom = atom<UpdateStatus>("idle");
export const updateInfoAtom = atom<Update | null>(null);
export const updateProgressAtom = atom<number>(0);
export const updateErrorAtom = atom<string>("");

/**
 * Whether this copy can install updates itself. Flatpak and package-manager
 * installs on Linux only learn about them and download from the release page.
 */
export const canSelfUpdateAtom = atom<boolean>(true);
/** From the install_kind command: "flatpak", "deb", "aur" and so on. */
export const installKindAtom = atom<string | null>(null);

/**
 * Preferences › About › Beta updates. Null until someone sets it, which
 * follows the build, so a beta installed by hand keeps getting betas.
 */
export const betaUpdatesSettingAtom = atomWithStorage<boolean | null>(
	"betaUpdates",
	null,
	undefined,
	{ getOnInit: true },
);

export const betaUpdatesAtom = atom(
	(get) => get(betaUpdatesSettingAtom) ?? isBetaVersion(APP_VERSION),
	(_get, set, enabled: boolean) => set(betaUpdatesSettingAtom, enabled),
);
