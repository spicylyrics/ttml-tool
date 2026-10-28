import { Button, DropdownMenu } from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { editModeToolsAtom } from "$/modules/lyric-editor/states/edit-mode-tools";
import { swapDuetLinesAtom } from "$/modules/lyric-editor/utils/swap-duet";
import { projectsHubEnabledAtom } from "$/modules/projects-hub/states";
import { spectrogramHoverSyncEnabledAtom } from "$/modules/settings/states/sync";
import { lyricLinesAtom } from "$/states/main";
import { useTopMenuActions } from "../useTopMenuActions";

const hasLyricLinesAtom = atom(
	(get) => get(lyricLinesAtom).lyricLines.length > 0,
);

type ToolMenuProps = {
	variant: "toolbar" | "submenu";
	triggerStyle?: CSSProperties;
	buttonStyle?: CSSProperties;
};

const ToolMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();
	const projectsHubEnabled = useAtomValue(projectsHubEnabledAtom);
	const [spectrogramHoverSyncEnabled, setSpectrogramHoverSyncEnabled] = useAtom(
		spectrogramHoverSyncEnabledAtom,
	);
	const editModeTools = useAtomValue(editModeToolsAtom);
	const hasLines = useAtomValue(hasLyricLinesAtom);
	const swapDuetLines = useSetAtom(swapDuetLinesAtom);

	return (
		<>
			<DropdownMenu.Sub>
				<DropdownMenu.SubTrigger>
					{t("topBar.menu.segmentationTools", "Segmentation tools")}
				</DropdownMenu.SubTrigger>
				<DropdownMenu.SubContent>
					<DropdownMenu.Item onSelect={menu.onAutoSegment}>
						{t("topBar.menu.autoSegment", "Auto segment…")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onOpenAdvancedSegmentation}>
						{t("topBar.menu.advancedSegment", "Advanced segmentation…")}
					</DropdownMenu.Item>
					<DropdownMenu.Item onSelect={menu.onOpenLearnedSplits}>
						{t("topBar.menu.learnedSplits", "Learned splits…")}
					</DropdownMenu.Item>
				</DropdownMenu.SubContent>
			</DropdownMenu.Sub>
			<DropdownMenu.Item onSelect={menu.onSyncLineTimestamps}>
				{t("topBar.menu.syncLineTimestamps", "Fit lines to their words")}
			</DropdownMenu.Item>
			{editModeTools && (
				<DropdownMenu.Item
					disabled={!hasLines}
					onSelect={() => swapDuetLines()}
				>
					{t("editModeTools.swapDuetAll", "Swap main and duet lines")}
				</DropdownMenu.Item>
			)}
			<DropdownMenu.CheckboxItem
				checked={spectrogramHoverSyncEnabled}
				onCheckedChange={setSpectrogramHoverSyncEnabled}
			>
				{t("topBar.menu.spectrogramHoverSync", "Sync at mouse position")}
			</DropdownMenu.CheckboxItem>
			<DropdownMenu.Item onSelect={menu.onOpenLatencyTest}>
				{t("settingsDialog.common.latencyTest", "音频/输入延迟测试")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenTTMLChecklist}>
				{projectsHubEnabled
					? t("projectsHub.songs.toolMenu", "To sync...")
					: t("topBar.menu.ttmlChecklist", "TTML checklist")}
			</DropdownMenu.Item>
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
