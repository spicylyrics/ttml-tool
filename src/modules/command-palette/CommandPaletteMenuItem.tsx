import { DropdownMenu } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { formatKeyBindings } from "$/utils/keybindings";
import { getPaletteCommands } from "./palette-commands";
import { commandPaletteEnabledAtom, commandPaletteOpenAtom } from "./states";

/** "Command palette..." for the Help menu. Renders nothing while the flag is off. */
export const CommandPaletteMenuItem = () => {
	const enabled = useAtomValue(commandPaletteEnabledAtom);
	return enabled ? <PaletteMenuItem /> : null;
};

const PaletteMenuItem = () => {
	const { t } = useTranslation();
	const setOpen = useSetAtom(commandPaletteOpenAtom);
	const keys = useAtomValue(getPaletteCommands().open.atom);
	return (
		<>
			<DropdownMenu.Item
				onSelect={() => setOpen(true)}
				shortcut={keys.length > 0 ? formatKeyBindings(keys) : undefined}
			>
				{t("commandPalette.menu", "Command palette...")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
		</>
	);
};
