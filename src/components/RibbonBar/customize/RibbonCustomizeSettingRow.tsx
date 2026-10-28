import { Options24Regular } from "@fluentui/react-icons";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { FieldRow } from "$/components/FieldRow";
import { SettingToggle } from "$/modules/settings/components/WorkflowControls";
import { ribbonCustomizeEnabledAtom } from "./states";

/** The Preferences row that turns ribbon customizing on. */
export const RibbonCustomizeSettingRow: FC = () => {
	const { t } = useTranslation();
	return (
		<FieldRow
			icon={<Options24Regular />}
			label={t("ribbonCustomize.settingLabel", "Customizable ribbons")}
			description={t(
				"ribbonCustomize.settingDesc",
				"Adds a Customize button to the Edit, Time and Preview ribbons, to hide, reorder or pin sections, or move them into a More menu.",
			)}
		>
			{({ controlId }) => (
				<SettingToggle id={controlId} setting={ribbonCustomizeEnabledAtom} />
			)}
		</FieldRow>
	);
};
