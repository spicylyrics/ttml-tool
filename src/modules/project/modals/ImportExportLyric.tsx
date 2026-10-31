import { DropdownMenu } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import {
	MENU_ACTIONS,
	type MenuActionContext,
} from "$/modules/menu-actions/actions";
import { MenuActionItem } from "$/modules/menu-actions/MenuActionItem";

const EXPORT_ACTIONS = [
	MENU_ACTIONS.exportTtml,
	MENU_ACTIONS.exportLrc,
	MENU_ACTIONS.exportEslrc,
	MENU_ACTIONS.exportQrc,
	MENU_ACTIONS.exportYrc,
	MENU_ACTIONS.exportLys,
	MENU_ACTIONS.exportAss,
];

export const ImportExportLyric = ({
	context,
}: {
	context: MenuActionContext;
}) => {
	const { t } = useTranslation();

	return (
		<>
			<MenuActionItem action={MENU_ACTIONS.importLyrics} context={context} />
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.exportLyric.export", "导出歌词...")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					{EXPORT_ACTIONS.map((action) => (
						<MenuActionItem
							key={action.command.id}
							action={action}
							context={context}
						/>
					))}
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		</>
	);
};
