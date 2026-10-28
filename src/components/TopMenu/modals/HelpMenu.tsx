import { Button, DropdownMenu } from "@radix-ui/themes";
import { useSetAtom } from "jotai";
import { Toolbar } from "radix-ui";
import type { CSSProperties } from "react";
import { Trans, useTranslation } from "react-i18next";
import { CommandPaletteMenuItem } from "$/modules/command-palette/CommandPaletteMenuItem";
import { guideWelcomeOpenAtom } from "$/modules/onboarding/states";
import {
	changelogDialogAtom,
	settingsDialogAtom,
	settingsTabAtom,
} from "$/states/dialogs.ts";
import { useTopMenuActions } from "../useTopMenuActions";

type HelpMenuProps = {
	variant: "toolbar" | "submenu";
	buttonStyle?: CSSProperties;
};

const HelpMenuItems = () => {
	const { t } = useTranslation();
	const menu = useTopMenuActions();
	const setChangelogOpen = useSetAtom(changelogDialogAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const setGuideWelcomeOpen = useSetAtom(guideWelcomeOpenAtom);
	const openAbout = () => {
		setSettingsTab("about");
		setSettingsOpen(true);
	};

	return (
		<>
			<CommandPaletteMenuItem />
			<DropdownMenu.Item onSelect={() => setGuideWelcomeOpen(true)}>
				{t("beginnerGuide.menu", "Start guide")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenGitHub}>
				{t("aboutModal.github", "Star on GitHub")}
			</DropdownMenu.Item>
			<DropdownMenu.Item onSelect={menu.onOpenGuides}>
				{t("topBar.menu.helpDoc", "TTML guides")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={() => setChangelogOpen(true)}>
				{t("topBar.menu.changelog", "Changelog & updates")}
			</DropdownMenu.Item>
			<DropdownMenu.Separator />
			<DropdownMenu.Item onSelect={openAbout}>
				{t("common.about", "About")}
			</DropdownMenu.Item>
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
