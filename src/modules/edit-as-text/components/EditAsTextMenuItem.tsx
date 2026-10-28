import { DropdownMenu } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { editAsTextDialogAtom, editAsTextEnabledAtom } from "../states";

/** Edit > Edit as text, shown only while the feature flag is on. */
export const EditAsTextMenuItem = () => {
	const { t } = useTranslation();
	const enabled = useAtomValue(editAsTextEnabledAtom);
	const openDialog = useSetAtom(editAsTextDialogAtom);
	if (!enabled) return null;
	return (
		<DropdownMenu.Item onSelect={() => openDialog(true)}>
			{t("editAsText.menuItem", "Edit as text...")}
		</DropdownMenu.Item>
	);
};
