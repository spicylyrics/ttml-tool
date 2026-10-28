import { formatKeyBindingsAsArray } from "$/utils/keybindings";
import type { KeyBindingsConfig } from "../types";
import { splitBinding } from "./key-index";
import { isModifierCode, layoutLabel } from "./layouts";
import type { KeyboardLayoutInfo } from "./use-keyboard-layout";

// Keys that only appear on caps, never in a saved shortcut's usual wording.
const CAP_ONLY_LABELS: Record<string, string> = {
	CapsLock: "Caps",
	ContextMenu: "Menu",
};

/** What a key cap prints, following the user's layout where it is known. */
export function capLabel(code: string, layout: KeyboardLayoutInfo): string {
	if (isModifierCode(code)) return formatKeyBindingsAsArray([code])[0];
	const reported = layout.labels?.get(code);
	if (reported && reported.trim().length === 1) return reported.toUpperCase();
	return (
		layoutLabel(layout.layout, code) ??
		CAP_ONLY_LABELS[code] ??
		formatKeyBindingsAsArray([code])[0]
	);
}

/**
 * A shortcut the way the keyboard view prints it: modifiers from the shared
 * formatter, keys as their caps print them, so it matches the board.
 */
export function formatViewCombo(
	binding: KeyBindingsConfig,
	layout: KeyboardLayoutInfo,
): string {
	const { modifiers, keys } = splitBinding(binding);
	const parts = [
		...formatKeyBindingsAsArray(modifiers),
		...keys.map((code) => capLabel(code, layout)),
	];
	return parts.join(navigator.userAgent.includes("Mac") ? "" : "+");
}
