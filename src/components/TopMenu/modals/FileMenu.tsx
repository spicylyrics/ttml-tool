import { Button, DropdownMenu } from "@radix-ui/themes";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans } from "react-i18next";
import { MENU_ACTIONS, type MenuAction } from "$/modules/menu-actions/actions";
import {
	MenuActionItem,
	useMenuActionContext,
} from "$/modules/menu-actions/MenuActionItem";
import { ImportExportLyric } from "$/modules/project/modals/ImportExportLyric";

type FileMenuProps = {
	variant: "toolbar" | "submenu";
	buttonStyle?: CSSProperties;
};

const FileMenuItems = () => {
	const context = useMenuActionContext();
	const item = (action: MenuAction) => (
		<MenuActionItem action={action} context={context} />
	);

	return (
		<>
			{item(MENU_ACTIONS.newFile)}
			{item(MENU_ACTIONS.openFile)}
			{item(MENU_ACTIONS.openFromClipboard)}
			{item(MENU_ACTIONS.saveFile)}
			<DropdownMenu.Separator />
			{item(MENU_ACTIONS.projects)}
			{item(MENU_ACTIONS.restoreFromHistory)}
			<DropdownMenu.Separator />
			{item(MENU_ACTIONS.saveToClipboard)}
			<DropdownMenu.Separator />
			<ImportExportLyric context={context} />
		</>
	);
};

export const FileMenu = (props: FileMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.file">文件</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<FileMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.file">文件</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<FileMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
