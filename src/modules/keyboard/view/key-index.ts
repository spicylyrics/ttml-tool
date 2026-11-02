import {
	formatKeyBindingsAsArray,
	normalizeKeyBindings,
} from "$/utils/keybindings";
import type { KeyBindingList } from "../binding-list";
import type { KeyBindingCommand, KeyBindingsConfig } from "../types";
import { isModifierCode, MODIFIER_CODES, type ModifierCode } from "./layouts";

export type ViewCategory = "sync" | "edit" | "playback" | "navigation";
export const VIEW_CATEGORIES: readonly ViewCategory[] = [
	"sync",
	"edit",
	"playback",
	"navigation",
];

const NAVIGATION_IDS = new Set([
	"switchEditMode",
	"switchSyncMode",
	"switchPreviewMode",
	"locateActiveLine",
	"interfaceScaleUp",
	"interfaceScaleUpAlternate",
	"interfaceScaleDown",
	"interfaceScaleReset",
]);

/** The keyboard view's four colors, mapped from the registry's categories. */
export function viewCategoryOf(command: KeyBindingCommand): ViewCategory {
	if (command.id.startsWith("move") || NAVIGATION_IDS.has(command.id))
		return "navigation";
	if (command.category === "Audio" || command.id.startsWith("audition"))
		return "playback";
	if (command.category === "Sync") return "sync";
	return "edit";
}

export interface SplitBinding {
	/** Held modifiers, in display order. */
	modifiers: ModifierCode[];
	/** The other keys; one for almost every shortcut, two for a chord. */
	keys: string[];
}

export function splitBinding(binding: KeyBindingsConfig): SplitBinding {
	const normalized = normalizeKeyBindings(binding);
	const keys = normalized.filter((key) => !isModifierCode(key));
	// A shortcut that is only modifiers (say, Shift alone) lives on its last key.
	if (keys.length === 0 && normalized.length > 0) {
		const last = normalized[normalized.length - 1];
		return {
			modifiers: MODIFIER_CODES.filter(
				(code) => code !== last && normalized.includes(code),
			),
			keys: [last],
		};
	}
	return {
		modifiers: MODIFIER_CODES.filter((code) => normalized.includes(code)),
		keys,
	};
}

export function layerKey(modifiers: readonly string[]): string {
	return MODIFIER_CODES.filter((code) => modifiers.includes(code)).join("+");
}

export interface KeyBindingRef {
	command: KeyBindingCommand;
	/** The binding as stored. */
	binding: KeyBindingsConfig;
	/** Its index in the command's list; 0 is the primary. */
	slot: number;
	modifiers: ModifierCode[];
	/** Other non-modifier keys in the same chord. */
	chordWith: string[];
}

/** Every binding, filed under each non-modifier key it uses. */
export function buildKeyIndex(
	bindings: ReadonlyArray<{
		command: KeyBindingCommand;
		lists: KeyBindingList;
	}>,
): Map<string, KeyBindingRef[]> {
	const index = new Map<string, KeyBindingRef[]>();
	for (const { command, lists } of bindings) {
		lists.forEach((binding, slot) => {
			if (binding.length === 0) return;
			const { modifiers, keys } = splitBinding(binding);
			for (const code of keys) {
				const refs = index.get(code) ?? [];
				refs.push({
					command,
					binding,
					slot,
					modifiers,
					chordWith: keys.filter((other) => other !== code),
				});
				index.set(code, refs);
			}
		});
	}
	return index;
}

/** The bindings on `code` held with exactly the modifiers in `layer`. */
export function refsInLayer(
	refs: readonly KeyBindingRef[] | undefined,
	layer: readonly string[],
): KeyBindingRef[] {
	const wanted = layerKey(layer);
	return (refs ?? []).filter((ref) => layerKey(ref.modifiers) === wanted);
}

/** Lowercase, accents and extra spaces removed, for forgiving search. */
export function normalizeSearch(text: string): string {
	return text
		.normalize("NFD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/\s+/g, " ")
		.trim();
}

/** The ids of commands whose name contains every word of `query`. */
export function matchCommands(
	commands: readonly KeyBindingCommand[],
	query: string,
	nameOf: (command: KeyBindingCommand) => string,
): Set<string> {
	const words = normalizeSearch(query).split(" ").filter(Boolean);
	if (words.length === 0) return new Set();
	return new Set(
		commands
			.filter((command) => {
				const name = normalizeSearch(nameOf(command));
				return words.every((word) => name.includes(word));
			})
			.map((command) => command.id),
	);
}

const KEY_ALIASES: Record<string, string[]> = {
	Control: ["ctrl", "control"],
	Meta: ["meta", "win", "cmd", "command", "super"],
	Alt: ["alt", "option", "opt"],
	Shift: ["shift"],
	Escape: ["esc", "escape"],
	Space: ["space", "spacebar"],
	Enter: ["enter", "return"],
	Backspace: ["backspace"],
	Delete: ["delete", "del"],
	ArrowUp: ["up"],
	ArrowDown: ["down"],
	ArrowLeft: ["left"],
	ArrowRight: ["right"],
	PageUp: ["pageup", "pgup"],
	PageDown: ["pagedown", "pgdn"],
};

/** Every name a key goes by: its printed label, its code and common aliases. */
function keyNames(code: string): string[] {
	const bare = code.replace(/^(Key|Digit|Numpad)/, "");
	return [
		normalizeSearch(formatKeyBindingsAsArray([code])[0] ?? ""),
		normalizeSearch(code),
		normalizeSearch(bare),
		...(KEY_ALIASES[code] ?? []),
	];
}

/** Whether every typed key appears in the shortcut, e.g. "ctrl s" or "Ctrl+S" in Ctrl+S. */
function bindingMatches(binding: KeyBindingsConfig, tokens: string[]) {
	const keys = normalizeKeyBindings(binding).map(keyNames);
	return tokens.every((token) => keys.some((names) => names.includes(token)));
}

export type SearchableBinding = {
	command: KeyBindingCommand;
	lists: KeyBindingList;
};

/**
 * The ids of actions a search finds. Names match on every word. Keys match
 * when the query is written as a shortcut ("Ctrl+S"), is a single key ("F",
 * "Space") that something is bound to, or names nothing but a key does.
 */
export function matchShortcutSearch(
	bindings: readonly SearchableBinding[],
	query: string,
	nameOf: (command: KeyBindingCommand) => string,
): Set<string> {
	const normalized = normalizeSearch(query);
	const tokens = normalized.split(/[\s+]+/).filter(Boolean);
	if (tokens.length === 0) return new Set();
	const byKey = new Set(
		bindings
			.filter(({ lists }) =>
				lists.some(
					(binding) => binding.length > 0 && bindingMatches(binding, tokens),
				),
			)
			.map(({ command }) => command.id),
	);
	if (normalized.includes("+")) return byKey;
	if (tokens.length === 1 && byKey.size > 0) return byKey;
	const byName = matchCommands(
		bindings.map(({ command }) => command),
		query,
		nameOf,
	);
	return byName.size > 0 ? byName : byKey;
}

/** The list with one slot replaced, or a new binding appended. */
export function withBinding(
	list: KeyBindingList,
	slot: number | "add",
	binding: KeyBindingsConfig,
): KeyBindingList {
	if (slot === "add") {
		// An unbound primary takes the new key before any extra does.
		if ((list[0] ?? []).length === 0) return [binding, ...list.slice(1)];
		return [...list, binding];
	}
	return list.map((keys, index) => (index === slot ? binding : keys));
}

/** The list without one slot. Removing the primary promotes the next key. */
export function withoutBinding(
	list: KeyBindingList,
	slot: number,
): KeyBindingList {
	const rest = list.filter((_, index) => index !== slot);
	return rest.length > 0 ? rest : [[]];
}
