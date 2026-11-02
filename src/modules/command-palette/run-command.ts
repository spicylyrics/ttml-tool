import type { createStore } from "jotai";
import type { KeyBindingCommand } from "$/modules/keyboard/types";
import {
	forceInvokeKeyBindingAtom,
	getShortcutKey,
	normalizeKeyBindings,
} from "$/utils/keybindings";

type Store = ReturnType<typeof createStore>;

const MODIFIERS = ["Control", "Meta", "Alt", "Shift"];

/** A KeyboardEvent.key good enough for listeners that read it. */
function keyForCode(code: string): string {
	const letter = /^Key([A-Z])$/.exec(code);
	if (letter) return letter[1].toLowerCase();
	const digit = /^(?:Digit|Numpad)(\d)$/.exec(code);
	if (digit) return digit[1];
	if (code === "Space") return " ";
	return code;
}

/**
 * Presses and releases a shortcut on `window`: each key down in order
 * (modifiers first), then each key up in reverse. That reaches handlers
 * registered by shortcut alone, in both the key-down and key-up trigger
 * modes, the same way a real press does.
 */
export function pressShortcut(keys: readonly string[]) {
	const normalized = getShortcutKey([...keys]).split(" + ");
	if (normalized.length === 0 || normalized[0] === "") return;
	const held = new Set(normalizeKeyBindings(normalized));
	const flags = {
		ctrlKey: held.has("Control"),
		metaKey: held.has("Meta"),
		altKey: held.has("Alt"),
		shiftKey: held.has("Shift"),
	};
	const codeFor = (key: string) =>
		MODIFIERS.includes(key) ? `${key}Left` : key;
	const fire = (type: "keydown" | "keyup", key: string) => {
		window.dispatchEvent(
			new KeyboardEvent(type, {
				code: codeFor(key),
				key: MODIFIERS.includes(key) ? key : keyForCode(key),
				bubbles: true,
				cancelable: true,
				...flags,
			}),
		);
	};
	for (const key of normalized) fire("keydown", key);
	for (const key of [...normalized].reverse()) fire("keyup", key);
}

/**
 * Runs a keyboard command the way its shortcut would.
 *
 * Most handlers register on the command's atom (`useKeyBindingAtom`), and
 * `forceInvokeKeyBindingAtom` calls those directly, even when the shortcut is
 * unbound. It only touches the event when a handler exists, so a probe event
 * tells us whether anything ran. Handlers registered by shortcut alone
 * (`useCommand`) aren't reachable that way, so for those the current shortcut
 * is pressed instead. Never both, so a toggle can't fire twice.
 *
 * Returns false when nothing could run it: no atom handler and no shortcut.
 */
export function runKeyboardCommand(
	store: Store,
	command: KeyBindingCommand,
): boolean {
	const probe = new Event("keydown", { cancelable: true }) as KeyboardEvent;
	forceInvokeKeyBindingAtom(store, command.atom, probe);
	if (probe.defaultPrevented) return true;
	const keys = store.get(command.atom);
	if (keys.length === 0) return false;
	pressShortcut(keys);
	return true;
}
