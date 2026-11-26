export type KeyValueStorage = Pick<
	Storage,
	"getItem" | "setItem" | "key" | "length"
>;

/** Keys the app writes on its own at startup, before anyone does anything. */
const WRITTEN_ON_START = new Set([
	"i18nextLng",
	"keybindingDefaultsVersion",
	"importLyrics.autoProcess",
]);

/**
 * Anything saved counts as having used the app. Guessing wrong this way only
 * gives a new user an old default; the other way would change a regular's.
 */
export function hasUsedApp(storage: KeyValueStorage) {
	for (let i = 0; i < storage.length; i++) {
		const name = storage.key(i);
		if (name !== null && !WRITTEN_ON_START.has(name)) return true;
	}
	return false;
}

/**
 * Whether storage held nothing of the user's when the app started. Settings
 * modules write their keys as they load, so main.tsx imports this module
 * first and later checks read this instead of looking again.
 */
export const startedAsNewInstall: boolean = (() => {
	try {
		return typeof localStorage !== "undefined" && !hasUsedApp(localStorage);
	} catch {
		// Storage can be blocked; treat it as a returning user.
		return false;
	}
})();
