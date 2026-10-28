import { Button, DropdownMenu } from "@radix-ui/themes";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { EditAsTextMenuItem } from "$/modules/edit-as-text/components/EditAsTextMenuItem";
import { formatKeyBindings } from "$/utils/keybindings";
import { useTopMenuActions } from "../useTopMenuActions";

type EditMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const EditMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();

	const getShortcut = (key: string[] | undefined) =>
		key ? formatKeyBindings(key) : undefined;

	return (
		<>
			<DropdownMenu.Item
				onSelect={menu.onUndo}
				shortcut={getShortcut(menu.undoKey)}
			>
				<Trans i18nKey="topBar.menu.undo">撤销</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onRedo}
				shortcut={getShortcut(menu.redoKey)}
			>
				<Trans i18nKey="topBar.menu.redo">重做</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onSelectAll}
				shortcut={getShortcut(menu.selectAllLinesKey)}
			>
				<Trans i18nKey="topBar.menu.selectAllLines">选中所有歌词行</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onUnselectAll}
				shortcut={getShortcut(menu.unselectAllLinesKey)}
			>
				<Trans i18nKey="topBar.menu.unselectAllLines">取消选中所有歌词行</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item
				onSelect={menu.onDeleteSelection}
				shortcut={getShortcut(menu.deleteSelectionKey)}
			>
				{t("settingsDialog.keybindings.deleteSelection", "Delete selection")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenTimeShift}>
				{t("topBar.menu.timeShift", "Time shift…")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenTimeStretch}>
				{t("topBar.menu.timeStretch", "Time stretch…")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenMetadataEditor}>
				<Trans i18nKey="topBar.menu.editMetadata">编辑歌词元数据</Trans>
			</DropdownMenu.Item>
			<EditAsTextMenuItem />
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onOpenSettings}>
				<Trans i18nKey="settingsDialog.title">首选项</Trans>
			</DropdownMenu.Item>
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
