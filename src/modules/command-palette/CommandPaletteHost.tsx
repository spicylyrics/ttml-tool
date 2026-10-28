import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useMemo } from "react";
import { LazyDialog } from "$/components/Dialogs/LazyDialog.tsx";
import { useCommand } from "$/modules/keyboard/hooks";
import { lazy } from "$/utils/lazy.ts";
import { getPaletteCommands } from "./palette-commands";
import { commandPaletteEnabledAtom, commandPaletteOpenAtom } from "./states";

const CommandPaletteDialog = lazy(() =>
	import("./CommandPalette.tsx").then((m) => ({
		default: m.CommandPaletteDialog,
	})),
);

/** Binds Ctrl+K and Ctrl+Shift+P, and loads the palette when they first fire. */
const CommandPaletteShortcuts = () => {
	const setOpen = useSetAtom(commandPaletteOpenAtom);
	const paletteCommands = useMemo(() => getPaletteCommands(), []);
	const toggle = useCallback(() => setOpen((value) => !value), [setOpen]);
	useCommand(paletteCommands.open, toggle, [toggle]);
	useCommand(paletteCommands.openAlternate, toggle, [toggle]);

	return (
		<LazyDialog openAtom={commandPaletteOpenAtom}>
			<CommandPaletteDialog />
		</LazyDialog>
	);
};

/** Mounted only while the flag is on, so nothing below binds keys when it's off. */
export const CommandPalette = () => {
	const enabled = useAtomValue(commandPaletteEnabledAtom);
	return enabled ? <CommandPaletteShortcuts /> : null;
};
