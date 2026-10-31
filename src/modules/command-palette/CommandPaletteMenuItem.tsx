import { DropdownMenu } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { cmdOpenCommandPalette } from "$/modules/keyboard/commands";
import { formatKeyBindings } from "$/utils/keybindings";
import { commandPaletteOpenAtom } from "./states";

/** "Command palette..." for the Help menu. */
export const CommandPaletteMenuItem = () => {
	const { t } = useTranslation();
	const setOpen = useSetAtom(commandPaletteOpenAtom);
	const keys = useAtomValue(cmdOpenCommandPalette.atom);
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
