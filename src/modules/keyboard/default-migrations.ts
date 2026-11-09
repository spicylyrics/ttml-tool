import type { KeyBindingsConfig } from "./types";

/**
 * When a default shortcut changes, people who already use the app keep the
 * old one and only new installs get the new one.
 *
 * A shortcut is stored only once someone changes it, so an untouched action
 * follows whatever default the code ships. Before the new defaults can take
 * over, this writes the previous default into storage for every changed
 * action the user never set, which looks to them as if they had set it.
 */
export const KEYBINDING_DEFAULTS_VERSION_KEY = "keybindingDefaultsVersion";

export interface KeyBindingDefaultChange {
	version: number;
	/** The default each action had before this version, by command id. */
	previous: Readonly<Record<string, KeyBindingsConfig>>;
}

/** Append-only. Each entry lists the defaults it replaced. */
export const KEYBINDING_DEFAULT_CHANGES: readonly KeyBindingDefaultChange[] = [
	{
		version: 1,
		previous: {
			auditionSelectionBefore: ["KeyQ"],
			auditionSelection: ["KeyB"],
			auditionSelectionAfter: ["KeyN"],
			movePrevWordAndPlay: ["KeyR"],
			moveNextWordAndPlay: ["KeyY"],
		},
	},
];

/** Keys the app writes on its own before anyone does anything. */
const WRITTEN_ON_START = new Set([
	"i18nextLng",
	KEYBINDING_DEFAULTS_VERSION_KEY,
]);

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "key" | "length">;

/**
 * Anything saved counts as having used the app. Guessing wrong this way only
 * gives a new user the old defaults; the other way would move a regular's keys.
 */
function hasUsedApp(storage: KeyValueStorage) {
	for (let i = 0; i < storage.length; i++) {
		const name = storage.key(i);
		if (name !== null && !WRITTEN_ON_START.has(name)) return true;
	}
	return false;
}

export function migrateKeyBindingDefaults(
	storage: KeyValueStorage,
	changes: readonly KeyBindingDefaultChange[] = KEYBINDING_DEFAULT_CHANGES,
) {
	const latest = changes[changes.length - 1]?.version ?? 0;
	const seen = Number(storage.getItem(KEYBINDING_DEFAULTS_VERSION_KEY)) || 0;
	if (seen >= latest) return;

	if (seen > 0 || hasUsedApp(storage)) {
		// Oldest first, so an action changed twice keeps the default this
		// user actually had.
		for (const change of changes) {
			if (change.version <= seen) continue;
			for (const [id, keys] of Object.entries(change.previous)) {
				const name = `keybindings:${id}`;
				if (storage.getItem(name) === null) {
					storage.setItem(name, JSON.stringify(keys));
				}
			}
		}
	}
	storage.setItem(KEYBINDING_DEFAULTS_VERSION_KEY, String(latest));
}
