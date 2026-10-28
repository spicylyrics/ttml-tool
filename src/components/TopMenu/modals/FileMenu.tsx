import { Button, DropdownMenu } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { ImportExportLyric } from "$/modules/project/modals/ImportExportLyric";
import { PreferencesFileMenuItem } from "$/modules/settings/shell/PreferencesFileMenuItem";
import { folderProjectsEnabledAtom } from "$/modules/settings/states";
import { formatKeyBindings } from "$/utils/keybindings";
import { useTopMenuActions } from "../useTopMenuActions";

type FileMenuProps = {
	variant: "toolbar" | "submenu";
	buttonStyle?: CSSProperties;
};

const FileMenuItems = () => {
	const menu = useTopMenuActions();
	const { t } = useTranslation();
	const folderProjectsEnabled = useAtomValue(folderProjectsEnabledAtom);

	const getShortcut = (key: string[] | undefined) =>
		key ? formatKeyBindings(key) : undefined;

	return (
		<>
			<DropdownMenu.Item
				onSelect={menu.onNewFile}
				shortcut={getShortcut(menu.newFileKey)}
			>
				<Trans i18nKey="topBar.menu.newLyric">新建 TTML 文件</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onOpenFile}
				shortcut={getShortcut(menu.openFileKey)}
			>
				<Trans i18nKey="topBar.menu.openLyric">打开 TTML 文件</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenFileFromClipboard}>
				<Trans i18nKey="topBar.menu.openFromClipboard">
					从剪切板打开 TTML 文件
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Item
				onSelect={menu.onSaveFile}
				shortcut={getShortcut(menu.saveFileKey)}
			>
				<Trans i18nKey="topBar.menu.saveLyric">保存 TTML 文件</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			{folderProjectsEnabled && (
				<DropdownMenu.Item onSelect={menu.onOpenProjects}>
					{t("topBar.menu.projects", "Projects")}
				</DropdownMenu.Item>
			)}
			<DropdownMenu.Item onSelect={menu.onOpenHistoryRestore}>
				<Trans i18nKey="topBar.menu.restoreFromHistory">
					从历史记录恢复...
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={menu.onSaveFileToClipboard}>
				<Trans i18nKey="topBar.menu.saveLyricToClipboard">
					保存 TTML 文件到剪切板
				</Trans>
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<ImportExportLyric onSaveTtml={menu.onSaveFile} />
			<PreferencesFileMenuItem />
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
