import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

/** Most recently run item ids, newest first. */
export const commandPaletteRecentAtom = atomWithStorage<string[]>(
	"commandPalette.recent",
	[],
);

export const commandPaletteOpenAtom = atom(false);

export const COMMAND_PALETTE_RECENT_LIMIT = 8;

export function pushRecent(recent: readonly string[], id: string): string[] {
	return [id, ...recent.filter((other) => other !== id)].slice(
		0,
		COMMAND_PALETTE_RECENT_LIMIT,
	);
}
