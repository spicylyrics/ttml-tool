import { Button, DropdownMenu } from "@radix-ui/themes";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { MENU_ACTIONS, type MenuAction } from "$/modules/menu-actions/actions";
import {
	MenuActionItem,
	useMenuActionContext,
} from "$/modules/menu-actions/MenuActionItem";

type ToolMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const ToolMenuItems = () => {
	const { t } = useTranslation();
	const context = useMenuActionContext();
	const item = (action: MenuAction) => (
		<MenuActionItem action={action} context={context} />
	);

	return (
		<>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.segmentationTools", "Segmentation tools")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					{item(MENU_ACTIONS.autoSegment)}
					{item(MENU_ACTIONS.advancedSegment)}
					{item(MENU_ACTIONS.learnedSplits)}
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			{item(MENU_ACTIONS.syncLineTimestamps)}
			{item(MENU_ACTIONS.swapDuetAll)}
			<DropdownMenu.Separator />
			{item(MENU_ACTIONS.spectrogramHoverSync)}
			<DropdownMenu.Separator />
			{item(MENU_ACTIONS.latencyTest)}
			{item(MENU_ACTIONS.ttmlChecklist)}
		</>
	);
};

export const ToolMenu = (props: ToolMenuProps) => {
	if (props.variant === "submenu") {
		return (
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					<Trans i18nKey="topBar.menu.tool">工具</Trans>
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<ToolMenuItems />
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
		);
	}

	return (
		<DropdownMenu.Root>
			<Toolbar.Button asChild>
				<DropdownMenu.Trigger style={props.triggerStyle}>
					<Button variant="soft" style={props.buttonStyle}>
						<Trans i18nKey="topBar.menu.tool">工具</Trans>
					</Button>
				</DropdownMenu.Trigger>
			</Toolbar.Button>
			<DropdownMenu.Content>
				<ToolMenuItems />
			</DropdownMenu.Content>
		</DropdownMenu.Root>
	);
};
