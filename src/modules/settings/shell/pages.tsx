import {
	Beaker24Regular,
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
import { Flex } from "@radix-ui/themes";
import type { TFunction } from "i18next";
import { useAtomValue } from "jotai";
import { Tabs } from "radix-ui";
import { type ComponentType, memo, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SectionHeader } from "$/components/SectionHeader";
import { AutoKeyBindingSettingsPanel } from "$/modules/keyboard/components/SettingsPanel";
import { keyboardViewEnabledAtom } from "$/modules/keyboard/flags";
import { KeyboardView } from "$/modules/keyboard/view/KeyboardView";
import { SettingsAboutTab } from "../modals/about";
import { SettingsAppearanceTab } from "../modals/appearance";
import { AudioSettingsTab } from "../modals/audio";
import { SettingsBackupTab } from "../modals/backup";
import { AutosaveSection } from "../modals/common/AutosaveSection";
import { DisplaySection } from "../modals/common/DisplaySection";
import { ImportCleanupSection } from "../modals/common/ImportCleanupSection";
import { PlaybackBehaviorSection } from "../modals/common/PlaybackBehaviorSection";
import { PlaybackSection } from "../modals/common/PlaybackSection";
import { PrivacySection } from "../modals/common/PrivacySection";
import { ProjectsSection } from "../modals/common/ProjectsSection";
import { SyncingSection } from "../modals/common/SyncingSection";
import {
	type CommonSettings,
	useCommonSettings,
} from "../modals/common/useCommonSettings";
import { SettingsSpectrogramTab } from "../modals/spectrogram";
import { WorkflowSettings } from "../modals/workflow";
import {
	type ExperimentalArea,
	ExperimentalPage,
	RELOCATED_SETTINGS,
} from "./experimental";
import styles from "./PreferencesShell.module.css";
import { type SectionId, SHELL_PAGE_MAP, type ShellPageId } from "./page-map";
import { RelocatedSettingsContext } from "./relocated";

export interface ShellPageDefinition {
	value: ShellPageId;
	icon: ReactNode;
	label: string;
	description?: string;
	keywords: string;
	content: ReactNode;
}

/** A General, Editor & sync or Files section, fed the state it always gets. */
const withCommonState = (Section: ComponentType<CommonSettings>) => {
	const CommonSection = () => <Section {...useCommonSettings()} />;
	return CommonSection;
};

/** The keyboard itself, while its flag is on. The switch is on Experimental. */
const ShellKeyboardView = () => {
	const { t } = useTranslation();
	const enabled = useAtomValue(keyboardViewEnabledAtom);
	if (!enabled) return null;
	return (
		<Flex direction="column" gap="3">
			<SectionHeader title={t("keyboardView.title", "Keyboard")} />
			<KeyboardView />
		</Flex>
	);
};

const PrivacyIfDesktop = withCommonState(PrivacySection);

/** The component that renders each section; the same ones the classic pages use. */
export const SECTION_CONTENT: Record<SectionId, ComponentType> = {
	display: withCommonState(DisplaySection),
	privacy: () =>
		import.meta.env.TAURI_ENV_PLATFORM ? <PrivacyIfDesktop /> : null,
	syncing: withCommonState(SyncingSection),
	playbackBehavior: withCommonState(PlaybackBehaviorSection),
	editMode: () => <WorkflowSettings groups={["editMode"]} />,
	timeModeDisplay: () => <WorkflowSettings groups={["timeModeDisplay"]} />,
	syncAids: () => <WorkflowSettings groups={["syncAids"]} />,
	preview: () => <WorkflowSettings groups={["preview"]} />,
	previewPerformance: () => (
		<WorkflowSettings groups={["previewPerformance"]} />
	),
	importCleanup: withCommonState(ImportCleanupSection),
	projects: withCommonState(ProjectsSection),
	autosave: withCommonState(AutosaveSection),
	backup: SettingsBackupTab,
	playback: withCommonState(PlaybackSection),
	equalizer: AudioSettingsTab,
	spectrogram: SettingsSpectrogramTab,
	keyboardView: ShellKeyboardView,
	keyBindings: AutoKeyBindingSettingsPanel,
	appearance: SettingsAppearanceTab,
	about: SettingsAboutTab,
};

const PAGE_ICONS: Record<ShellPageId, ReactNode> = {
	common: <Settings24Regular />,
	appearance: <PaintBrush24Regular />,
	editing: <Edit24Regular />,
	syncing: <Timer24Regular />,
	preview: <Eye24Regular />,
	audio: <Speaker224Regular />,
	files: <Folder24Regular />,
	backup: <History24Regular />,
	keybinding: <Keyboard12324Regular />,
	experimental: <Beaker24Regular />,
	about: <Info24Regular />,
};

function pageText(
	t: TFunction,
): Record<ShellPageId, { label: string; description?: string }> {
	return {
		common: {
			label: t("settingsDialog.tab.common", "General"),
			description: t(
				"settingsDialog.page.generalDesc",
				"Language, privacy, and app-wide behavior.",
			),
		},
		appearance: { label: t("settingsDialog.tab.appearance", "Appearance") },
		editing: {
			label: t("preferencesPages.editing", "Editing"),
			description: t(
				"preferencesPages.editingDesc",
				"What Edit mode shows on each line and word.",
			),
		},
		syncing: {
			label: t("preferencesPages.syncing", "Syncing"),
			description: t(
				"preferencesPages.syncingDesc",
				"Timing keys, offsets, and what Time mode shows.",
			),
		},
		preview: {
			label: t("preferencesPages.preview", "Preview"),
			description: t(
				"preferencesPages.previewDesc",
				"What the Preview tab shows and how smoothly it runs.",
			),
		},
		audio: {
			label: t("preferencesPages.audio", "Audio & spectrogram"),
			description: t(
				"settingsDialog.page.audioDesc",
				"Playback, equalizer, and spectrogram display.",
			),
		},
		files: {
			label: t("preferencesPages.files", "Import & files"),
			description: t(
				"preferencesPages.filesDesc",
				"Import cleanup, export, and folder projects.",
			),
		},
		backup: {
			label: t("preferencesPages.backup", "Backup"),
			description: t(
				"preferencesPages.backupDesc",
				"Autosave history and portable backups.",
			),
		},
		keybinding: { label: t("settingsDialog.tab.keybindings", "Shortcuts") },
		experimental: {
			label: t("preferencesPages.experimental", "Experimental"),
			description: t(
				"preferencesPages.experimentalDesc",
				"Features still in progress. Each stays off until you turn it on.",
			),
		},
		about: { label: t("common.about", "About") },
	};
}

/** The shell's pages, built from `SHELL_PAGE_MAP` with the classic components. */
export function getShellPages(t: TFunction): ShellPageDefinition[] {
	const text = pageText(t);
	const areaLabels = Object.fromEntries(
		Object.entries(text).map(([value, { label }]) => [value, label]),
	) as Record<ExperimentalArea, string>;
	return SHELL_PAGE_MAP.map((entry) => ({
		value: entry.value,
		icon: PAGE_ICONS[entry.value],
		...text[entry.value],
		keywords: entry.keywords,
		content:
			entry.value === "experimental" ? (
				<ExperimentalPage areaLabels={areaLabels} />
			) : (
				// Flags show on Experimental only, so these pages leave them out.
				<RelocatedSettingsContext.Provider value={RELOCATED_SETTINGS}>
					{entry.sections.map((section) => {
						const Section = SECTION_CONTENT[section];
						return <Section key={section} />;
					})}
				</RelocatedSettingsContext.Provider>
			),
	}));
}

/**
 * Every page as a tab panel. While searching, all of them stay mounted (the
 * inactive ones hidden) so their text can be read. Memoized on that flag alone
 * so typing in the search box doesn't re-render every page.
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
