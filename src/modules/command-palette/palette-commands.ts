import {
	cmdOpenCommandPalette,
	cmdOpenCommandPaletteAlternate,
	cmdSyncLineEnd,
	cmdSyncLineNext,
	cmdSyncLineStart,
} from "$/modules/keyboard/commands";
import type { KeyBindingCommand } from "$/modules/keyboard/types";

/**
 * Whether a command's handler is active in an editor mode. Takes any string
 * so modes the keyboard registry doesn't know yet just list no commands.
 */
export function commandRunsInMode(
	command: Pick<KeyBindingCommand, "modes">,
	mode: string,
): boolean {
	return (command.modes as readonly string[]).includes(mode);
}

export const PALETTE_COMMAND_IDS: ReadonlySet<string> = new Set([
	cmdOpenCommandPalette.id,
	cmdOpenCommandPaletteAlternate.id,
]);

/**
 * Sync commands are the timing keys (start, next and end word, move between
 * words and lines, and the rest of the Sync group on the Shortcuts page).
 * They're pressed in rhythm with the audio, so running one from a search
 * box is never useful.
 */
export function isSyncCommand(
	command: Pick<KeyBindingCommand, "id" | "category">,
) {
	return command.category === "Sync" && !LINE_SYNC_COMMAND_IDS.has(command.id);
}

/**
 * Whole-line timing ships with no shortcut, so the palette is how it's found
 * and run until one is set. It times against the playhead like the keys do.
 */
const LINE_SYNC_COMMAND_IDS: ReadonlySet<string> = new Set([
	cmdSyncLineStart.id,
	cmdSyncLineNext.id,
	cmdSyncLineEnd.id,
]);

/**
 * Whether the palette lists a command in an editor mode: it has to run there,
 * it can't be one of the palette's own shortcuts, and in Time mode the sync
 * commands are left out.
 */
export function paletteListsCommand(
	command: Pick<KeyBindingCommand, "id" | "category" | "modes">,
	mode: string,
): boolean {
	if (PALETTE_COMMAND_IDS.has(command.id)) return false;
	if (mode === "sync" && isSyncCommand(command)) return false;
	return commandRunsInMode(command, mode);
}
