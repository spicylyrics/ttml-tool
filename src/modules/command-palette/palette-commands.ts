import { t } from "$/modules/keyboard/i18n-helper";
import { getCommandById, registerCommand } from "$/modules/keyboard/registry";
import type { KeyBindingCommand } from "$/modules/keyboard/types";

const CONTROL_KEY = navigator.userAgent.includes("Mac") ? "Meta" : "Control";

/**
 * The palette's own shortcuts (Ctrl+K and Ctrl+Shift+P), registered on first
 * use instead of in `keyboard/commands.ts`. Only the palette calls this, and
 * only while its flag is on, so with the flag off the Shortcuts page and the
 * key handlers stay exactly as they were.
 */
export function getPaletteCommands(): {
	open: KeyBindingCommand;
	openAlternate: KeyBindingCommand;
} {
	return {
		open:
			getCommandById("openCommandPalette") ??
			registerCommand(
				"openCommandPalette",
				[CONTROL_KEY, "KeyK"],
				t("commandPalette.shortcut"),
				"View",
			),
		openAlternate:
			getCommandById("openCommandPaletteAlternate") ??
			registerCommand(
				"openCommandPaletteAlternate",
				[CONTROL_KEY, "Shift", "KeyP"],
				t("commandPalette.shortcutAlternate"),
				"View",
			),
	};
}

export const PALETTE_COMMAND_IDS: ReadonlySet<string> = new Set([
	"openCommandPalette",
	"openCommandPaletteAlternate",
]);
