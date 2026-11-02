/**
 * An action's shortcuts as a list: `[primary, ...extras]`.
 *
 * The primary stays in `keybindings:<id>` exactly as before, so older builds
 * and older backups keep working. Extra keys live in `keybindings:<id>Extra`
 * (same prefix, so settings backups carry them). No `.` in the key: the backup
 * preview splits stored names on dots.
 */
import { type Atom, atom, type WritableAtom } from "jotai";
import { atomWithStorage, RESET } from "jotai/utils";
import {
	getShortcutKey,
	normalizeKeyBindings,
	RESET_KEYBINDING,
	setDoublePressResolver,
	setExtraKeyBindingsResolver,
} from "$/utils/keybindings";
import { getAllCommands } from "./registry";
import { doublePressAtom } from "./states";
import type { KeyBindingCommand, KeyBindingsConfig } from "./types";

export type KeyBindingList = KeyBindingsConfig[];

const EXTRA_SUFFIX = "Extra";
const NO_EXTRAS: KeyBindingList = [];

export function extraKeyBindingsStorageKey(commandId: string) {
	return `keybindings:${commandId}${EXTRA_SUFFIX}`;
}

function isKeyBinding(value: unknown): value is KeyBindingsConfig {
	return Array.isArray(value) && value.every((key) => typeof key === "string");
}

/**
 * Reads any stored shape as a list: a single binding (`["KeyF"]`, the old
 * shape) becomes `[single]`, a list stays a list, anything else is empty.
 * Empty entries and repeats are dropped.
 */
export function toKeyBindingList(value: unknown): KeyBindingList {
	if (!Array.isArray(value)) return [];
	const list = isKeyBinding(value) ? [value] : value.filter(isKeyBinding);
	return dedupeKeyBindingList(list);
}

/** Drops empty bindings and later repeats of the same shortcut. */
export function dedupeKeyBindingList(
	list: readonly KeyBindingsConfig[],
	skip: readonly KeyBindingsConfig[] = [],
): KeyBindingList {
	const seen = new Set(skip.map((keys) => getShortcutKey(keys)));
	const result: KeyBindingList = [];
	for (const keys of list) {
		if (keys.length === 0) continue;
		const joined = getShortcutKey(keys);
		if (seen.has(joined)) continue;
		seen.add(joined);
		result.push(normalizeKeyBindings(keys));
	}
	return result;
}

type ExtraStorageAtom = WritableAtom<
	unknown,
	[KeyBindingList | typeof RESET],
	void
>;
const extraStorageAtoms = new Map<string, ExtraStorageAtom>();

function extraStorageAtom(commandId: string) {
	let stored = extraStorageAtoms.get(commandId);
	if (!stored) {
		stored = atomWithStorage<unknown>(
			extraKeyBindingsStorageKey(commandId),
			NO_EXTRAS,
			undefined,
			{ getOnInit: true },
		) as ExtraStorageAtom;
		extraStorageAtoms.set(commandId, stored);
	}
	return stored;
}

/** Writes extras, removing the key when there are none (no stray backup rows). */
function storedExtras(list: KeyBindingList): KeyBindingList | typeof RESET {
	return list.length > 0 ? list : RESET;
}

const extraAtoms = new Map<string, Atom<KeyBindingList>>();

/**
 * The extra shortcuts that are live for dispatch. With none stored it is always
 * the same empty array, so hooks don't re-register for it.
 */
export function extraKeyBindingsAtom(
	command: KeyBindingCommand,
): Atom<KeyBindingList> {
	let extras = extraAtoms.get(command.id);
	if (!extras) {
		const stored = extraStorageAtom(command.id);
		extras = atom((get) => {
			const list = dedupeKeyBindingList(toKeyBindingList(get(stored)), [
				get(command.atom),
			]);
			return list.length > 0 ? list : NO_EXTRAS;
		});
		extraAtoms.set(command.id, extras);
	}
	return extras;
}

type BindingListAtom = WritableAtom<
	KeyBindingList,
	[KeyBindingList | typeof RESET_KEYBINDING],
	Promise<void>
>;
const listAtoms = new Map<string, BindingListAtom>();

/**
 * `[primary, ...extras]`. Index 0 is always the primary, even when unbound.
 * Writing a list stores its first entry as the primary and the rest as extras;
 * `RESET_KEYBINDING` restores the default and drops the extras.
 */
export function keyBindingListAtom(
	command: KeyBindingCommand,
): BindingListAtom {
	let list = listAtoms.get(command.id);
	if (!list) {
		const extras = extraKeyBindingsAtom(command);
		const stored = extraStorageAtom(command.id);
		list = atom(
			(get) => [get(command.atom), ...get(extras)],
			async (_get, set, update) => {
				if (update === RESET_KEYBINDING) {
					set(stored, RESET);
					await set(command.atom, RESET_KEYBINDING);
					return;
				}
				const [primary = [], ...rest] = update;
				const normalized = normalizeKeyBindings(primary);
				set(stored, storedExtras(dedupeKeyBindingList(rest, [normalized])));
				await set(command.atom, normalized);
			},
		);
		listAtoms.set(command.id, list);
	}
	return list;
}

/** Every registered action with its live list, for conflict checks and views. */
export const allKeyBindingListsAtom = atom((get) =>
	getAllCommands().map((command) => ({
		command,
		lists: get(keyBindingListAtom(command)),
	})),
);

function findCommandByAtom(binding: unknown): KeyBindingCommand | undefined {
	return getAllCommands().find((command) => command.atom === binding);
}

// Hooks in `$/utils/keybindings` read extras through this resolver, which keeps
// that module free of imports from this one.
const resolved = new WeakMap<object, Atom<KeyBindingList> | null>();
setExtraKeyBindingsResolver((binding) => {
	let extras = resolved.get(binding);
	if (extras === undefined) {
		const command = findCommandByAtom(binding);
		extras = command ? extraKeyBindingsAtom(command) : null;
		// Commands register at import time; only cache once one is found.
		if (command) resolved.set(binding, extras);
	}
	return extras ?? undefined;
});

const resolvedDoublePress = new WeakMap<object, Atom<boolean>>();
setDoublePressResolver((binding) => {
	let flag = resolvedDoublePress.get(binding);
	if (!flag) {
		const command = findCommandByAtom(binding);
		if (!command) return undefined;
		flag = doublePressAtom(command.id);
		resolvedDoublePress.set(binding, flag);
	}
	return flag;
});
