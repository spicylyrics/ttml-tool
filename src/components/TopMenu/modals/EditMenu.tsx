import { Button, DropdownMenu } from "@radix-ui/themes";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans } from "react-i18next";
import { MENU_ACTIONS, type MenuAction } from "$/modules/menu-actions/actions";
import {
	MenuActionItem,
	useMenuActionContext,
} from "$/modules/menu-actions/MenuActionItem";

type EditMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const EditMenuItems = () => {
	const context = useMenuActionContext();
	const item = (action: MenuAction) => (
		<MenuActionItem action={action} context={context} />
	);

	return (
		<>
			{item(MENU_ACTIONS.undo)}
			{item(MENU_ACTIONS.redo)}
			<DropdownMenu.Separator />
			{item(MENU_ACTIONS.selectAll)}
			{item(MENU_ACTIONS.unselectAll)}
			<DropdownMenu.Separator />
			{item(MENU_ACTIONS.deleteSelection)}
			<DropdownMenu.Separator />
			{item(MENU_ACTIONS.timeShift)}
			{item(MENU_ACTIONS.timeStretch)}
			{item(MENU_ACTIONS.editMetadata)}
			{item(MENU_ACTIONS.editAsText)}
			<DropdownMenu.Separator />
			{item(MENU_ACTIONS.preferences)}
		</>
	);
};

export const EditMenu = (props: EditMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.edit">编辑</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<EditMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger style={props.triggerStyle}>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.edit">编辑</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<EditMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
