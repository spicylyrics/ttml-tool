import { getShortcutKey } from "$/utils/keybindings";
import type { KeyBindingCommand, KeyBindingsConfig } from "./types";

export function findKeyBindingConflicts(
	bindings: Array<{ command: KeyBindingCommand; keys: KeyBindingsConfig }>,
): Map<string, KeyBindingCommand[]> {
	return findKeyBindingListConflicts(
		bindings.map(({ command, keys }) => ({ command, lists: [keys] })),
	);
}

/**
 * Like {@link findKeyBindingConflicts}, but each action can have several
 * shortcuts. Two actions conflict when any of their shortcuts match in a mode
 * they share. An action repeating its own shortcut is not a conflict.
 */
export function findKeyBindingListConflicts(
	bindings: Array<{
		command: KeyBindingCommand;
		lists: readonly KeyBindingsConfig[];
	}>,
): Map<string, KeyBindingCommand[]> {
	const shortcutsOf = bindings.map(
		({ lists }) =>
			new Set(
				lists.filter((keys) => keys.length > 0).map((k) => getShortcutKey(k)),
			),
	);
	const conflicts = new Map<string, KeyBindingCommand[]>();
	bindings.forEach(({ command }, index) => {
		const own = shortcutsOf[index];
		if (own.size === 0) return;
		const matches = bindings.filter(
			(other, otherIndex) =>
				other.command.id !== command.id &&
				command.modes.some((mode) => other.command.modes.includes(mode)) &&
				[...shortcutsOf[otherIndex]].some((shortcut) => own.has(shortcut)),
		);
		if (matches.length > 0) {
			conflicts.set(
				command.id,
				matches.map((match) => match.command),
			);
		}
	});
	return conflicts;
}

/** The actions, other than `command`, that already use `keys` in a shared mode. */
export function findShortcutOwners(
	bindings: ReadonlyArray<{
		command: KeyBindingCommand;
		lists: readonly KeyBindingsConfig[];
	}>,
	keys: KeyBindingsConfig,
	command?: KeyBindingCommand,
): KeyBindingCommand[] {
	if (keys.length === 0) return [];
	const shortcut = getShortcutKey(keys);
	return bindings
		.filter(
			(other) =>
				other.command.id !== command?.id &&
				(!command ||
					command.modes.some((mode) => other.command.modes.includes(mode))) &&
				other.lists.some(
					(list) => list.length > 0 && getShortcutKey(list) === shortcut,
				),
		)
		.map((other) => other.command);
}
