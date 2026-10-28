import { Switch } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { FieldRow } from "$/components/FieldRow";
import { preferencesShellEnabledAtom } from "./states";

/**
 * Switches Preferences between the classic dialog and the new shell. Shown at
 * the bottom of both sidebars, so the layout can be tried and turned back off
 * from the place it changes.
 */
export const ShellFlagToggle = ({ className }: { className?: string }) => {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(preferencesShellEnabledAtom);
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
					onCheckedChange={setEnabled}
				/>
			)}
		</FieldRow>
	);
};
