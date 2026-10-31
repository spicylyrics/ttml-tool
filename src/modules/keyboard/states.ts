import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/**
 * Actions set to "Press twice to run", by command id. The `keybindings:`
 * prefix files it with the shortcuts in backups; `@` keeps it clear of
 * command ids.
 */
export const DOUBLE_PRESS_STORAGE_KEY = "keybindings:@doublePress";
/** The old Auto segment-only setting this list replaces. */
export const LEGACY_AUTO_SEGMENT_DOUBLE_PRESS_KEY =
	"keybindings.autoSegment.doublePress";
/** Quick auto segment has always needed a double press unless turned off. */
const DEFAULT_DOUBLE_PRESS = ["autoSegment"];

type KeyValueStorage = Pick<Storage, "getItem" | "setItem" | "removeItem">;

/**
 * Moves the old Auto segment switch into the per-action list once, so nobody's
 * Auto segment changes: on (or never set) keeps it on double press, off keeps
 * it on a single press.
 */
export function migrateDoublePressSetting(storage: KeyValueStorage) {
	if (storage.getItem(DOUBLE_PRESS_STORAGE_KEY) !== null) return;
	const legacy = storage.getItem(LEGACY_AUTO_SEGMENT_DOUBLE_PRESS_KEY);
	if (legacy === null) return;
	let on = true;
	try {
		on = JSON.parse(legacy) !== false;
	} catch {
		// A value we can't read keeps the old default.
	}
	storage.setItem(
		DOUBLE_PRESS_STORAGE_KEY,
		JSON.stringify(on ? DEFAULT_DOUBLE_PRESS : []),
	);
	storage.removeItem(LEGACY_AUTO_SEGMENT_DOUBLE_PRESS_KEY);
}

try {
	if (typeof localStorage !== "undefined")
		migrateDoublePressSetting(localStorage);
} catch {
	// Storage can be blocked; the default below still applies.
}

export const doublePressCommandsAtom = atomWithStorage<string[]>(
	DOUBLE_PRESS_STORAGE_KEY,
	DEFAULT_DOUBLE_PRESS,
	undefined,
	{ getOnInit: true },
);

const doublePressAtoms = new Map<
	string,
	ReturnType<typeof createDoublePressAtom>
>();

function createDoublePressAtom(commandId: string) {
	return atom(
		(get) => get(doublePressCommandsAtom).includes(commandId),
		(get, set, on: boolean) => {
			const ids = get(doublePressCommandsAtom).filter((id) => id !== commandId);
			set(doublePressCommandsAtom, on ? [...ids, commandId] : ids);
		},
	);
}

/** The Shortcuts page's search: filters the action list and lights up keys on the board. */
export const shortcutSearchAtom = atom("");

/** Whether the Shortcuts list also shows actions that have no key. */
export const shortcutShowAllAtom = atom(false);

/** Whether one action waits for a second press; writable for the toggle. */
export function doublePressAtom(commandId: string) {
	let cached = doublePressAtoms.get(commandId);
	if (!cached) {
		cached = createDoublePressAtom(commandId);
		doublePressAtoms.set(commandId, cached);
	}
	return cached;
}
