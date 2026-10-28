import { DropdownMenu } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { Trans } from "react-i18next";
import { settingsDialogAtom } from "$/states/dialogs.ts";
import { preferencesShellEnabledAtom } from "./states";

/**
 * Preferences at the end of the File menu, where most apps keep it. Only with
 * the new layout on; the Edit menu entry stays either way.
 */
export const PreferencesFileMenuItem = () => {
	const enabled = useAtomValue(preferencesShellEnabledAtom);
	const setOpen = useSetAtom(settingsDialogAtom);
	if (!enabled) return null;
	return (
		<>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={() => setOpen(true)}>
				<Trans i18nKey="settingsDialog.title">Preferences</Trans>
			</DropdownMenu.Item>
		</>
	);
};
