import { Button, DropdownMenu } from "@radix-ui/themes";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans } from "react-i18next";
import { CommandPaletteMenuItem } from "$/modules/command-palette/CommandPaletteMenuItem";
import { MENU_ACTIONS, type MenuAction } from "$/modules/menu-actions/actions";
import {
	MenuActionItem,
	useMenuActionContext,
} from "$/modules/menu-actions/MenuActionItem";

type HelpMenuProps = {
	variant: "toolbar" | "submenu";
	buttonStyle?: CSSProperties;
};

const HelpMenuItems = () => {
	const context = useMenuActionContext();
	const item = (action: MenuAction) => (
		<MenuActionItem action={action} context={context} />
	);

	return (
		<>
			<CommandPaletteMenuItem />
			{item(MENU_ACTIONS.startGuide)}
			{item(MENU_ACTIONS.github)}
			{item(MENU_ACTIONS.guides)}
			<DropdownMenu.Separator />
			{item(MENU_ACTIONS.changelog)}
			<DropdownMenu.Separator />
			{item(MENU_ACTIONS.about)}
		</>
	);
};

export const HelpMenu = (props: HelpMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.help">帮助</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<HelpMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.help">帮助</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<HelpMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
