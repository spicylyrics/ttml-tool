import { Switch } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { FieldRow } from "$/components/FieldRow";
import { settingsTabAtom } from "$/states/dialogs.ts";
import { toClassicPage } from "./page-map";
import { preferencesShellEnabledAtom } from "./states";

/**
 * Switches Preferences between the classic dialog and the new shell. Shown at
 * the bottom of the classic sidebar and on the shell's Experimental page.
 */
export const ShellFlagToggle = ({ className }: { className?: string }) => {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(preferencesShellEnabledAtom);
	const [tab, setTab] = useAtom(settingsTabAtom);
	const onCheckedChange = (next: boolean) => {
		// The classic dialog has no Experimental (or Editing, Backup...) page.
		if (!next) setTab(toClassicPage(tab));
		setEnabled(next);
	};
	return (
		<FieldRow
			className={className}
			label={t("preferencesShell.flagLabel", "New Preferences layout")}
			description={t(
				"preferencesShell.flagDesc",
				"Search on top and a sidebar that fits long names. Turn off to go back to the classic layout.",
			)}
		>
			{({ controlId, descriptionId }) => (
				<Switch
					id={controlId}
					aria-describedby={descriptionId}
					checked={enabled}
					onCheckedChange={onCheckedChange}
				/>
			)}
		</FieldRow>
	);
};
