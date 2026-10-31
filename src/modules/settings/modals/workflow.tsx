import {
	ArrowAutofitWidth24Regular,
	ArrowSortDownLines24Regular,
	Blur24Regular,
	Clock24Regular,
	DataLine24Regular,
	ErrorCircle24Regular,
	Eye24Regular,
	EyeOff24Regular,
	Flash24Regular,
	Highlight24Regular,
	History24Regular,
	Image24Regular,
	NumberSymbol24Regular,
	Options24Regular,
	PanelRight24Regular,
	Rename24Regular,
	Sparkle24Regular,
	TapSingle24Regular,
	TextDescription24Regular,
	TextEditStyle24Regular,
	TextLineSpacing24Regular,
	TextWordCount24Regular,
	Timeline24Regular,
	TopSpeed24Regular,
} from "@fluentui/react-icons";
import { Box, Card, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { useAtom, type WritableAtom } from "jotai";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { SlIcon } from "$/components/SlIcon";
import { advancedRibbonControlsAtom } from "$/modules/onboarding/states";
import { showPreviewPanelAtom } from "$/states/main";
// Relative on purpose: keeps this import apart from other settings rows' imports.
import {
	editScrollMemoryAtom,
	splitTypedLinesAtom,
} from "../../lyric-editor/states/edit-mode-tools";
import {
	BackgroundSyncControl,
	PreviewModeControl,
	SettingToggle,
	SpicyBackgroundControl,
	SyncLevelControl,
} from "../components/WorkflowControls";
import {
	displayRomanizationInSyncAtom,
	enableManualTimestampEditAtom,
	enableSyncGlowAnimationAtom,
	highlightActiveWordAtom,
	highlightErrorsAtom,
	showLineRomanizationAtom,
	showLineTranslationAtom,
	showTimestampsAtom,
	showWordRomanizationInputAtom,
} from "../states";
import {
	instantHighlightFadeAtom,
	lyricWordFadeWidthAtom,
	showFpsCounterAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicyForceLineSyncedAtom,
	spicySimpleLyricsModeAtom,
	vsyncAtom,
} from "../states/preview";
import {
	enableTimeModeDoubleClickEditAtom,
	showTouchSyncPanelAtom,
	timingOverviewAutoScrollAtom,
	visualizeTimestampUpdateAtom,
} from "../states/sync";

type BooleanSetting = WritableAtom<boolean, [boolean], unknown>;

/** Title key, fallback, description key, fallback, icon, then the setting. */
type ToggleRow = readonly [
	string,
	string,
	string,
	string,
	ReactNode,
	BooleanSetting,
];

const editModeToggles: readonly ToggleRow[] = [
	[
		"settings.common.advancedRibbonControls",
		"Show advanced ribbon controls",
		"settings.workflow.advancedRibbonControlsDesc",
		"Show more controls in the ribbon toolbar.",
		<Options24Regular key="icon" />,
		advancedRibbonControlsAtom,
	],
	[
		"ribbonBar.editMode.showTranslation",
		"Show translation line",
		"settings.workflow.showTranslationDesc",
		"Show a translation field under each lyric line.",
		<SlIcon name="translation" size={24} key="icon" />,
		showLineTranslationAtom,
	],
	[
		"ribbonBar.editMode.showRomanization",
		"Show romanization line",
		"settings.workflow.showRomanizationDesc",
		"Show a romanization field under each lyric line.",
		<SlIcon name="romanization" size={24} key="icon" />,
		showLineRomanizationAtom,
	],
	[
		"ribbonBar.editMode.showWordRomanizationInput",
		"Show per-word romanization",
		"settings.workflow.showWordRomanizationInputDesc",
		"Show a romanization field on each word.",
		<TextEditStyle24Regular key="icon" />,
		showWordRomanizationInputAtom,
	],
	// Behavior after the fields: what typing does, and where a project reopens.
	[
		"editModeTools.splitTypedLinesTitle",
		"Split typed lines into words",
		"editModeTools.splitTypedLinesDesc",
		"Text typed into an empty line is split into words, the same way an import splits lines.",
		<TextWordCount24Regular key="icon" />,
		splitTypedLinesAtom,
	],
	[
		"editModeTools.scrollMemoryTitle",
		"Remember Edit mode position",
		"editModeTools.scrollMemoryDesc",
		"Reopen each project at the line you were on in Edit mode.",
		<History24Regular key="icon" />,
		editScrollMemoryAtom,
	],
];

const timeModeDisplayToggles: readonly ToggleRow[] = [
	[
		"ribbonBar.syncMode.showTimestamps",
		"Show timestamps",
		"settings.workflow.showTimestampsDesc",
		"Show start and end times on each word.",
		<Clock24Regular key="icon" />,
		showTimestampsAtom,
	],
	[
		"ribbonBar.syncMode.highlightActiveWord",
		"Highlight active word",
		"settings.workflow.highlightActiveWordDesc",
		"Highlight the word that is playing right now.",
		<Highlight24Regular key="icon" />,
		highlightActiveWordAtom,
	],
	[
		"ribbonBar.syncMode.enableGlowAnimation",
		"Enable glow animation",
		"settings.workflow.enableGlowAnimationDesc",
		"Fill each word with a glow as it plays.",
		<Sparkle24Regular key="icon" />,
		enableSyncGlowAnimationAtom,
	],
	[
		"settings.assistant.highlightErrors",
		"Highlight timing errors",
		"settings.assistant.highlightErrorsDesc",
		"Mark words whose start time is after their end time.",
		<ErrorCircle24Regular key="icon" />,
		highlightErrorsAtom,
	],
	[
		"settings.assistant.visualizeTimestampUpdate",
		"Visualize timestamp updates",
		"settings.assistant.visualizeTimestampUpdateDesc",
		"Briefly flash a timestamp when a shortcut changes it.",
		<Flash24Regular key="icon" />,
		visualizeTimestampUpdateAtom,
	],
	[
		"ribbonBar.syncMode.showPerWordRomanization",
		"Show per-word romanization",
		"settings.workflow.showPerWordRomanizationDesc",
		"Show each word's romanization under it.",
		<SlIcon name="romanization" size={24} key="icon" />,
		displayRomanizationInSyncAtom,
	],
	[
		"ribbonBar.editMode.previewPanel",
		"Preview panel",
		"settings.workflow.previewPanelDesc",
		"Show a live lyric preview next to the word list.",
		<PanelRight24Regular key="icon" />,
		showPreviewPanelAtom,
	],
];

const syncAidToggles: readonly ToggleRow[] = [
	[
		"settings.assistant.manualTimestampEdit",
		"Manual timestamp editing",
		"settings.assistant.manualTimestampEditDesc",
		"Click a timestamp in Time mode to type a new value.",
		<NumberSymbol24Regular key="icon" />,
		enableManualTimestampEditAtom,
	],
	[
		"ribbonBar.syncMode.doubleClickEdit",
		"Double-click word editing",
		"settings.workflow.doubleClickEditDesc",
		"Double-click a word to fix its text while syncing.",
		<Rename24Regular key="icon" />,
		enableTimeModeDoubleClickEditAtom,
	],
	[
		"ribbonBar.syncMode.touchSyncPanel",
		"Touch sync panel",
		"settings.workflow.touchSyncPanelDesc",
		"Show on-screen Start, Next and End buttons for touch screens.",
		<TapSingle24Regular key="icon" />,
		showTouchSyncPanelAtom,
	],
];

const previewToggles: readonly ToggleRow[] = [
	[
		"ribbonBar.previewMode.showTranslation",
		"Show translation",
		"settings.workflow.previewShowTranslationDesc",
		"Show translation lines in the preview.",
		<SlIcon name="translation" size={24} key="icon" />,
		showTranslationLinesAtom,
	],
	[
		"ribbonBar.previewMode.showRoman",
		"Show romanization",
		"settings.workflow.previewShowRomanDesc",
		"Show romanization in the preview.",
		<SlIcon name="romanization" size={24} key="icon" />,
		showRomanLinesAtom,
	],
	[
		"ribbonBar.previewMode.simpleLyrics",
		"Simple Lyrics mode",
		"settings.workflow.simpleLyricsDesc",
		"Match Spicy Lyrics' Simple Lyrics mode, with calmer word animations.",
		<TextDescription24Regular key="icon" />,
		spicySimpleLyricsModeAtom,
	],
	[
		"ribbonBar.previewMode.forceLineRendering",
		"Show as line-synced",
		"settings.workflow.forceLineRenderingDesc",
		"Show every line in the Spicy preview as line-synced, without word timing.",
		<TextLineSpacing24Regular key="icon" />,
		spicyForceLineSyncedAtom,
	],
	[
		"ribbonBar.previewMode.instantFade",
		"Instant fade-out",
		"settings.workflow.instantFadeDesc",
		"Drop a word's highlight as soon as it ends instead of fading it out slowly.",
		<Blur24Regular key="icon" />,
		instantHighlightFadeAtom,
	],
	[
		"ribbonBar.previewMode.autoScroll",
		"Auto-Scroll",
		"settings.workflow.timingOverviewAutoScrollDesc",
		"Keep the timing overview scrolled to the playhead.",
		<ArrowSortDownLines24Regular key="icon" />,
		timingOverviewAutoScrollAtom,
	],
];

const performanceToggles: readonly ToggleRow[] = [
	[
		"settings.preview.vsync",
		"Smooth preview (every frame)",
		"settings.workflow.vsyncDesc",
		"Update the Standard and Toxi previews every frame instead of about 30 times per second. Smoother, but uses more CPU.",
		<TopSpeed24Regular key="icon" />,
		vsyncAtom,
	],
	[
		"ribbonBar.previewMode.showFps",
		"Show FPS",
		"settings.workflow.showFpsDesc",
		"Show a frame rate counter on the preview.",
		<DataLine24Regular key="icon" />,
		showFpsCounterAtom,
	],
];

const SettingRow = ({
	icon,
	title,
	description,
	children,
	asLabel,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	children: ReactNode;
	asLabel?: boolean;
}) => {
	const row = (
		<Flex gap="3" align="center">
			{icon}
			<Box flexGrow="1">
				<Flex align="center" justify="between" gap="4">
					<Flex direction="column" gap="1">
						<Text>{title}</Text>
						<Text size="1" color="gray">
							{description}
						</Text>
					</Flex>
					{children}
				</Flex>
			</Box>
		</Flex>
	);
	return <Card>{asLabel ? <Text as="label">{row}</Text> : row}</Card>;
};

export type WorkflowGroup =
	| "editMode"
	| "timeModeDisplay"
	| "syncAids"
	| "preview"
	| "previewPerformance";

const ALL_GROUPS: readonly WorkflowGroup[] = [
	"editMode",
	"timeModeDisplay",
	"syncAids",
	"preview",
	"previewPerformance",
];

/** The editor's groups of settings; Preferences shows each on its own page. */
export const WorkflowSettings = ({
	groups = ALL_GROUPS,
}: {
	groups?: readonly WorkflowGroup[];
}) => {
	const { t } = useTranslation();
	const [fadeWidth, setFadeWidth] = useAtom(lyricWordFadeWidthAtom);
	const toggles = (rows: readonly ToggleRow[]) =>
		rows.map(([titleKey, title, descKey, desc, icon, setting]) => (
			<SettingRow
				key={titleKey}
				icon={icon}
				title={t(titleKey, title)}
				description={t(descKey, desc)}
				asLabel
			>
				<SettingToggle setting={setting} />
			</SettingRow>
		));
	return (
		<Flex direction="column" gap="4">
			{groups.includes("editMode") && (
				<Flex direction="column" gap="3">
					<Heading size="4">
						{t("settings.group.editModeDisplay", "Edit mode")}
					</Heading>
					{toggles(editModeToggles)}
				</Flex>
			)}
			{groups.includes("timeModeDisplay") && (
				<Flex direction="column" gap="3">
					<Heading size="4">
						{t("settings.group.timeModeDisplay", "Time mode display")}
					</Heading>
					{toggles(timeModeDisplayToggles)}
				</Flex>
			)}
			{groups.includes("syncAids") && (
				<Flex direction="column" gap="3">
					<Heading size="4">
						{t("settings.group.syncAids", "Syncing aids")}
					</Heading>
					<SettingRow
						icon={<Timeline24Regular />}
						title={t("ribbonBar.syncMode.syncLevel", "Sync by")}
						description={t(
							"settings.workflow.syncLevelDesc",
							"Word: time each word as you go. Line: time whole lines and spread their words out evenly, for a rough sync you fine-tune in the spectrogram.",
						)}
					>
						<SyncLevelControl variant="segmented" />
					</SettingRow>
					<SettingRow
						icon={<EyeOff24Regular />}
						title={t("ribbonBar.syncMode.bgLyricSync", "Background lines")}
						description={t(
							"settings.workflow.bgLyricSyncDesc",
							"How G and H treat background lines while syncing.",
						)}
					>
						<BackgroundSyncControl variant="segmented" />
					</SettingRow>
					{toggles(syncAidToggles)}
				</Flex>
			)}
			{groups.includes("preview") && (
				<Flex direction="column" gap="3">
					<Heading size="4">
						{t("settings.group.previewControls", "Preview")}
					</Heading>
					<SettingRow
						icon={<Eye24Regular />}
						title={t("ribbonBar.previewMode.mode", "Mode")}
						description={t(
							"settings.workflow.previewModeDesc",
							"Choose which preview the Preview tab shows.",
						)}
					>
						<PreviewModeControl variant="segmented" />
					</SettingRow>
					<SettingRow
						icon={<Image24Regular />}
						title={t("ribbonBar.previewMode.background", "Background")}
						description={t(
							"settings.workflow.spicyBackgroundDesc",
							"What shows behind the Spicy preview.",
						)}
					>
						<SpicyBackgroundControl variant="segmented" />
					</SettingRow>
					{toggles(previewToggles)}
					<SettingRow
						icon={<ArrowAutofitWidth24Regular />}
						title={t("ribbonBar.previewMode.fadeWidth", "Fade width")}
						description={t(
							"settings.workflow.fadeWidthDesc",
							"How soft the edge of the highlight is as a word fills in the Standard and Toxi previews.",
						)}
					>
						<TextField.Root
							type="number"
							min={0}
							step={0.1}
							value={fadeWidth}
							style={{ width: 80 }}
							onChange={(event) => {
								const value = event.target.valueAsNumber;
								if (Number.isFinite(value)) setFadeWidth(Math.max(0, value));
							}}
						/>
					</SettingRow>
				</Flex>
			)}
			{groups.includes("previewPerformance") && (
				<Flex direction="column" gap="3">
					<Heading size="4">
						{t("settings.group.previewPerformance", "Preview performance")}
					</Heading>
					{toggles(performanceToggles)}
				</Flex>
			)}
		</Flex>
	);
};
