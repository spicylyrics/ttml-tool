import {
	Archive24Regular,
	Edit24Regular,
	Eye24Regular,
	Folder24Regular,
	History24Regular,
	Info24Regular,
	Keyboard12324Regular,
	PaintBrush24Regular,
	Settings24Regular,
	Speaker224Regular,
	Timer24Regular,
} from "@fluentui/react-icons";
import type { TFunction } from "i18next";
import type { ComponentType, ReactNode } from "react";
import { ChangelogScreen } from "$/modules/changelog/ChangelogScreen.tsx";
import { SettingsAboutTab } from "./about";
import { SettingsAppearanceTab } from "./appearance";
import { AudioSettingsTab } from "./audio";
import { SettingsBackupTab } from "./backup";
import { AutosaveSection } from "./common/AutosaveSection";
import { DisplaySection } from "./common/DisplaySection";
import { ImportCleanupSection } from "./common/ImportCleanupSection";
import { PlaybackBehaviorSection } from "./common/PlaybackBehaviorSection";
import { PlaybackSection } from "./common/PlaybackSection";
import { PrivacySection } from "./common/PrivacySection";
import { ProjectsSection } from "./common/ProjectsSection";
import { SyncingSection } from "./common/SyncingSection";
import { useCommonSettings } from "./common/useCommonSettings";
import { SettingsKeyBindingsDialog } from "./keybindings";
import { SettingsSpectrogramTab } from "./spectrogram";
import { WorkflowSettings } from "./workflow";

export type SettingsPageId =
	| "common"
	| "appearance"
	| "editing"
	| "syncing"
	| "preview"
	| "audio"
	| "files"
	| "backup"
	| "keybinding"
	| "changelog"
	| "about";

export interface SettingsPageDefinition {
	value: SettingsPageId;
	icon: ReactNode;
	label: string;
	/** Pages sharing a cluster sit together in the sidebar, apart from the next. */
	cluster: number;
	/** Off for pages whose text would match nearly any search (release notes). */
	searchText: boolean;
	Content: ComponentType;
}

const GeneralPage = () => {
	const state = useCommonSettings();
	return (
		<>
			<DisplaySection {...state} />
			{import.meta.env.TAURI_ENV_PLATFORM && <PrivacySection {...state} />}
		</>
	);
};

const SyncingPage = () => {
	const state = useCommonSettings();
	return (
		<>
			<SyncingSection {...state} />
			<PlaybackBehaviorSection {...state} />
			<WorkflowSettings groups={["timeModeDisplay", "syncAids"]} />
		</>
	);
};

const AudioPage = () => {
	const state = useCommonSettings();
	return (
		<>
			<PlaybackSection {...state} />
			<AudioSettingsTab />
			<SettingsSpectrogramTab />
		</>
	);
};

const FilesPage = () => {
	const state = useCommonSettings();
	return (
		<>
			<ImportCleanupSection {...state} />
			<ProjectsSection {...state} />
		</>
	);
};

const BackupPage = () => {
	const state = useCommonSettings();
	return (
		<>
			<AutosaveSection {...state} />
			<SettingsBackupTab />
		</>
	);
};

const EditingPage = () => <WorkflowSettings groups={["editMode"]} />;

const PreviewPage = () => (
	<WorkflowSettings groups={["preview", "previewPerformance"]} />
);

/**
 * The pages in sidebar order. The middle cluster follows the editor's own
 * Edit, Time and Preview modes, then the audio they all run on.
 */
export function getSettingsPages(t: TFunction): SettingsPageDefinition[] {
	return [
		{
			value: "common",
			icon: <Settings24Regular />,
			label: t("settingsDialog.tab.common", "General"),
			cluster: 0,
			searchText: true,
			Content: GeneralPage,
		},
		{
			value: "appearance",
			icon: <PaintBrush24Regular />,
			label: t("settingsDialog.tab.appearance", "Appearance"),
			cluster: 0,
			searchText: true,
			Content: SettingsAppearanceTab,
		},
		{
			value: "editing",
			icon: <Edit24Regular />,
			label: t("settingsDialog.tab.editing", "Editing"),
			cluster: 1,
			searchText: true,
			Content: EditingPage,
		},
		{
			value: "syncing",
			icon: <Timer24Regular />,
			label: t("settingsDialog.tab.syncing", "Syncing"),
			cluster: 1,
			searchText: true,
			Content: SyncingPage,
		},
		{
			value: "preview",
			icon: <Eye24Regular />,
			label: t("settingsDialog.tab.preview", "Preview"),
			cluster: 1,
			searchText: true,
			Content: PreviewPage,
		},
		{
			value: "audio",
			icon: <Speaker224Regular />,
			label: t("settingsDialog.tab.audioSpectrogram", "Audio & spectrogram"),
			cluster: 1,
			searchText: true,
			Content: AudioPage,
		},
		{
			value: "files",
			icon: <Folder24Regular />,
			label: t("settingsDialog.tab.importFiles", "Import & files"),
			cluster: 2,
			searchText: true,
			Content: FilesPage,
		},
		{
			value: "backup",
			icon: <Archive24Regular />,
			label: t("settingsDialog.tab.backup", "Backup"),
			cluster: 2,
			searchText: true,
			Content: BackupPage,
		},
		{
			value: "keybinding",
			icon: <Keyboard12324Regular />,
			label: t("settingsDialog.tab.keybindings", "Shortcuts"),
			cluster: 2,
			searchText: true,
			Content: SettingsKeyBindingsDialog,
		},
		{
			value: "changelog",
			icon: <History24Regular />,
			label: t("settingsDialog.tab.changelog", "Changelog"),
			cluster: 3,
			searchText: false,
			Content: ChangelogScreen,
		},
		{
			value: "about",
			icon: <Info24Regular />,
			label: t("common.about", "About"),
			cluster: 3,
			searchText: true,
			Content: SettingsAboutTab,
		},
	];
}

/** Tab ids from before the split, which deep links and old code may still set. */
const RETIRED_TABS: Record<string, SettingsPageId> = {
	editor: "syncing",
	assistant: "common",
	ai: "common",
	dev: "common",
};

const PAGE_IDS = new Set<string>([
	"common",
	"appearance",
	"editing",
	"syncing",
	"preview",
	"audio",
	"files",
	"backup",
	"keybinding",
	"changelog",
	"about",
]);

/** The page to show for any tab id: a current one, a retired one, or General. */
export function resolveSettingsPage(tab: string): SettingsPageId {
	if (PAGE_IDS.has(tab)) return tab as SettingsPageId;
	return RETIRED_TABS[tab] ?? "common";
}
