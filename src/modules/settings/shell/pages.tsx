import {
	Edit24Regular,
	Folder24Regular,
	Info24Regular,
	Keyboard12324Regular,
	PaintBrush24Regular,
	Settings24Regular,
	Speaker224Regular,
} from "@fluentui/react-icons";
import type { TFunction } from "i18next";
import { Tabs } from "radix-ui";
import { memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SectionHeader } from "$/components/SectionHeader";
import { SettingsAboutTab } from "../modals/about";
import { SettingsAppearanceTab } from "../modals/appearance";
import { AudioSettingsTab } from "../modals/audio";
import { SettingsBackupTab } from "../modals/backup";
import { SettingsCommonTab } from "../modals/common";
import { SettingsKeyBindingsDialog } from "../modals/keybindings";
import { SettingsSpectrogramTab } from "../modals/spectrogram";
import styles from "./PreferencesShell.module.css";

export interface ShellPageDefinition {
	value: string;
	icon: ReactNode;
	label: string;
	description?: string;
	content: ReactNode;
}

/**
 * The classic dialog's pages, in its order, rendering the same components. The
 * reorganization (phase 2) changes this list, not the page files.
 */
export function getShellPages(t: TFunction): ShellPageDefinition[] {
	return [
		{
			value: "common",
			icon: <Settings24Regular />,
			label: t("settingsDialog.tab.common", "General"),
			description: t(
				"settingsDialog.page.generalDesc",
				"Language, privacy, and app-wide behavior.",
			),
			content: <SettingsCommonTab section="general" />,
		},
		{
			value: "editor",
			icon: <Edit24Regular />,
			label: t("settingsDialog.tab.editor", "Editor & sync"),
			description: t(
				"settingsDialog.page.editorDesc",
				"Timing input, synchronization behavior, and visual cues.",
			),
			content: <SettingsCommonTab section="editor" />,
		},
		{
			value: "files",
			icon: <Folder24Regular />,
			label: t("settingsDialog.tab.files", "Files & storage"),
			description: t(
				"settingsDialog.page.filesDesc",
				"Import cleanup, autosave history, and portable backups.",
			),
			content: (
				<>
					<SettingsCommonTab section="files" />
					<SettingsBackupTab />
				</>
			),
		},
		{
			value: "audio",
			icon: <Speaker224Regular />,
			label: t("settingsDialog.tab.audio", "Audio"),
			description: t(
				"settingsDialog.page.audioDesc",
				"Playback, equalizer, and spectrogram display.",
			),
			content: (
				<>
					<SettingsCommonTab section="audio" />
					<AudioSettingsTab />
					<SettingsSpectrogramTab />
				</>
			),
		},
		{
			value: "keybinding",
			icon: <Keyboard12324Regular />,
			label: t("settingsDialog.tab.keybindings", "Shortcuts"),
			content: <SettingsKeyBindingsDialog />,
		},
		{
			value: "appearance",
			icon: <PaintBrush24Regular />,
			label: t("settingsDialog.tab.appearance", "Appearance"),
			content: <SettingsAppearanceTab />,
		},
		{
			value: "about",
			icon: <Info24Regular />,
			label: t("common.about", "About"),
			content: <SettingsAboutTab />,
		},
	];
}

/**
 * Every page as a tab panel. While searching, all of them stay mounted (the
 * inactive ones hidden) so their text can be read. Memoized on that flag alone
 * so typing in the search box doesn't re-render seven pages.
 */
export const ShellPages = memo(({ forceMount }: { forceMount: boolean }) => {
	const { t } = useTranslation();
	const pages = getShellPages(t);
	const mount = forceMount || undefined;
	return (
		<>
			{pages.map((page) => (
				<Tabs.Content
					key={page.value}
					value={page.value}
					forceMount={mount}
					className={styles.tabContent}
				>
					<div className={styles.page}>
						<SectionHeader
							as="h2"
							size="5"
							title={page.label}
							description={page.description}
							className={styles.pageHeader}
						/>
						<div className={styles.pageBody} data-shell-page-body={page.value}>
							{page.content}
						</div>
					</div>
				</Tabs.Content>
			))}
		</>
	);
});
