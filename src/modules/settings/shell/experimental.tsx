import {
	Keyboard12324Regular,
	Layer24Regular,
	LayerDiagonal24Regular,
	Mic24Regular,
	TextAlignLeft24Regular,
	Wrench24Regular,
} from "@fluentui/react-icons";
import { Button, Flex } from "@radix-ui/themes";
import {
	atom,
	type SetStateAction,
	useAtomValue,
	useSetAtom,
	type WritableAtom,
} from "jotai";
import { RESET } from "jotai/utils";
import { type ComponentType, type FC, type ReactNode, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { FieldRow } from "$/components/FieldRow";
import { Panel } from "$/components/Panel";
import { RibbonCustomizeSettingRow } from "$/components/RibbonBar/customize/RibbonCustomizeSettingRow";
import { ribbonCustomizeEnabledAtom } from "$/components/RibbonBar/customize/states";
import { SectionHeader } from "$/components/SectionHeader";
import { CommandPaletteSetting } from "$/modules/command-palette/CommandPaletteSetting";
import { commandPaletteEnabledAtom } from "$/modules/command-palette/states";
import { EditAsTextSetting } from "$/modules/edit-as-text/components/EditAsTextSetting";
import { editAsTextEnabledAtom } from "$/modules/edit-as-text/states";
import { keyboardViewEnabledAtom } from "$/modules/keyboard/flags";
import { KeyboardViewSection } from "$/modules/keyboard/view/KeyboardViewSection";
import { lineSyncEnabledAtom } from "$/modules/line-sync/states";
import { LogoColorSection } from "$/modules/logo-color/LogoColorSection";
import { logoColorEnabledAtom } from "$/modules/logo-color/states";
import { editModeToolsAtom } from "$/modules/lyric-editor/states/edit-mode-tools";
import { sectionEditingEnabledAtom } from "$/modules/lyric-editor/states/section-editing";
import { ImportSplitChoiceSetting } from "$/modules/lyrics-import/components/ImportSplitChoiceSetting";
import { importSplitChoiceEnabledAtom } from "$/modules/lyrics-import/flags";
import { PreviewProblemsSetting } from "$/modules/preview-problems/PreviewProblemsSetting";
import { showPreviewTimingProblemsAtom } from "$/modules/preview-problems/states";
import { ProjectsHubToggle } from "$/modules/projects-hub/components/ProjectsHubToggle";
import { projectsHubEnabledAtom } from "$/modules/projects-hub/states";
import { ReferenceSidebarSetting } from "$/modules/reference-sidebar/ReferenceSidebarSetting";
import { referenceSidebarEnabledAtom } from "$/modules/reference-sidebar/states";
import { RomanizationToolsSettings } from "$/modules/romanization/RomanizationToolsSettings";
import { romanizationToolsFlagAtom } from "$/modules/romanization/states";
import { SettingToggle } from "$/modules/settings/components/WorkflowControls";
import { FollowPlayheadSettings } from "$/modules/spectrogram/components/FollowPlayheadSettings";
import { spectrogramFollowFeatureAtom } from "$/modules/spectrogram/states/follow-playhead";
import { spectrogramLanesEnabledAtom } from "$/modules/spectrogram/states/lanes.ts";
import { timeModeWordEditingEnabledAtom } from "$/modules/time-mode-editing/states";
import { TimeModeEditingSettings } from "$/modules/time-mode-editing/TimeModeEditingSettings";
import { transcriptionModeEnabledAtom } from "$/modules/transcription/states";
import { updatedToastEnabledAtom } from "$/modules/updated-toast/states";
import { UpdatedToastSetting } from "$/modules/updated-toast/UpdatedToastSetting";
import { ShellFlagToggle } from "./ShellFlagToggle";
import { preferencesShellEnabledAtom } from "./states";

/** A flag's on/off atom, as `atomWithStorage` makes it (so RESET works). */
type FlagAtom = WritableAtom<
	boolean,
	[SetStateAction<boolean> | typeof RESET],
	void
>;

/** The page a flag's feature belongs to; it is grouped under that page's name. */
export type ExperimentalArea =
	| "common"
	| "appearance"
	| "editing"
	| "syncing"
	| "preview"
	| "audio"
	| "files"
	| "keybinding";

export interface ExperimentalFlag {
	/** Stable id, for keys and tests. */
	id: string;
	area: ExperimentalArea;
	atom: FlagAtom;
	/** The row on the Experimental page: the flag's own setting component. */
	Row: ComponentType;
	/**
	 * What the classic pages render for this flag (its component, or its atom
	 * for rows built inline). The shell hides it there, so it shows only here.
	 */
	classicRow: unknown;
	/** Included in the area's "Turn all off". */
	resettable: boolean;
}

/** A row for a flag the classic pages build inline, from the same strings. */
function inlineFlagRow(
	setting: FlagAtom,
	icon: ReactNode,
	[titleKey, title, descKey, desc]: readonly [string, string, string, string],
): ComponentType {
	const InlineFlagRow: FC = () => {
		const { t } = useTranslation();
		return (
			<Panel>
				<FieldRow
					icon={icon}
					label={t(titleKey, title)}
					description={t(descKey, desc)}
				>
					{({ controlId }) => (
						<SettingToggle id={controlId} setting={setting} />
					)}
				</FieldRow>
			</Panel>
		);
	};
	return InlineFlagRow;
}

/** Search reads Cards as rows; these two components aren't one on their own. */
const inPanel = (Row: ComponentType): ComponentType => {
	const PanelRow: FC = () => (
		<Panel>
			<Row />
		</Panel>
	);
	return PanelRow;
};

const ShellFlagRow = inPanel(ShellFlagToggle);

/**
 * Every feature flag from the overnight work, by area. The Experimental page
 * renders them in this order; the other shell pages leave them out.
 */
export const EXPERIMENTAL_FLAGS: readonly ExperimentalFlag[] = [
	{
		id: "preferencesShell",
		area: "common",
		atom: preferencesShellEnabledAtom,
		Row: ShellFlagRow,
		classicRow: ShellFlagToggle,
		// Resetting it would swap this dialog for the classic one mid-click.
		resettable: false,
	},
	{
		id: "commandPalette",
		area: "common",
		atom: commandPaletteEnabledAtom,
		Row: CommandPaletteSetting,
		classicRow: CommandPaletteSetting,
		resettable: true,
	},
	{
		id: "updatedToast",
		area: "common",
		atom: updatedToastEnabledAtom,
		Row: UpdatedToastSetting,
		classicRow: UpdatedToastSetting,
		resettable: true,
	},
	{
		id: "logoColor",
		area: "appearance",
		atom: logoColorEnabledAtom,
		Row: LogoColorSection,
		classicRow: LogoColorSection,
		resettable: true,
	},
	{
		id: "ribbonCustomize",
		area: "appearance",
		atom: ribbonCustomizeEnabledAtom,
		Row: inPanel(RibbonCustomizeSettingRow),
		classicRow: RibbonCustomizeSettingRow,
		resettable: true,
	},
	{
		id: "sectionEditing",
		area: "editing",
		atom: sectionEditingEnabledAtom,
		Row: inlineFlagRow(sectionEditingEnabledAtom, <LayerDiagonal24Regular />, [
			"sectionEditing.toggleTitle",
			"Section editing tools",
			"sectionEditing.toggleDesc",
			"Click a section header to rename or retype it, start a section on any line, and copy timings between repeated sections.",
		]),
		classicRow: sectionEditingEnabledAtom,
		resettable: true,
	},
	{
		id: "editModeTools",
		area: "editing",
		atom: editModeToolsAtom,
		Row: inlineFlagRow(editModeToolsAtom, <Wrench24Regular />, [
			"editModeTools.toggleTitle",
			"Edit mode tools",
			"editModeTools.toggleDesc",
			"Split a typed line into words, swap main and duet lines, and reopen each project where you left Edit mode.",
		]),
		classicRow: editModeToolsAtom,
		resettable: true,
	},
	{
		id: "editAsText",
		area: "editing",
		atom: editAsTextEnabledAtom,
		Row: EditAsTextSetting,
		classicRow: EditAsTextSetting,
		resettable: true,
	},
	{
		id: "transcription",
		area: "editing",
		atom: transcriptionModeEnabledAtom,
		Row: inlineFlagRow(transcriptionModeEnabledAtom, <Mic24Regular />, [
			"transcription.enable",
			"Transcribe tab",
			"transcription.enableDesc",
			"Add a Transcribe tab for typing lyrics as plain text while the song plays.",
		]),
		classicRow: transcriptionModeEnabledAtom,
		resettable: true,
	},
	{
		id: "referenceSidebar",
		area: "editing",
		atom: referenceSidebarEnabledAtom,
		Row: ReferenceSidebarSetting,
		classicRow: ReferenceSidebarSetting,
		resettable: true,
	},
	{
		id: "romanizationTools",
		area: "editing",
		atom: romanizationToolsFlagAtom,
		Row: RomanizationToolsSettings,
		classicRow: RomanizationToolsSettings,
		resettable: true,
	},
	{
		id: "lineSync",
		area: "syncing",
		atom: lineSyncEnabledAtom,
		Row: inlineFlagRow(lineSyncEnabledAtom, <TextAlignLeft24Regular />, [
			"lineSync.flagTitle",
			"Line syncing",
			"lineSync.flagDesc",
			"Lets each song be timed by word or by whole line. In Line mode, F, G and H start and end whole lines.",
		]),
		classicRow: lineSyncEnabledAtom,
		resettable: true,
	},
	{
		id: "timeModeWordEditing",
		area: "syncing",
		atom: timeModeWordEditingEnabledAtom,
		Row: TimeModeEditingSettings,
		classicRow: TimeModeEditingSettings,
		resettable: true,
	},
	{
		id: "previewProblems",
		area: "preview",
		atom: showPreviewTimingProblemsAtom,
		Row: PreviewProblemsSetting,
		classicRow: PreviewProblemsSetting,
		resettable: true,
	},
	{
		id: "spectrogramFollow",
		area: "audio",
		atom: spectrogramFollowFeatureAtom,
		Row: inPanel(FollowPlayheadSettings),
		classicRow: FollowPlayheadSettings,
		resettable: true,
	},
	{
		id: "spectrogramLanes",
		area: "audio",
		atom: spectrogramLanesEnabledAtom,
		Row: inlineFlagRow(spectrogramLanesEnabledAtom, <Layer24Regular />, [
			"spectrogramLanes.settingTitle",
			"Separate lanes",
			"spectrogramLanes.settingDesc",
			"Draw background lines in their own row under the main lines. Lanes are view-only: change a line's role in Edit mode.",
		]),
		classicRow: spectrogramLanesEnabledAtom,
		resettable: true,
	},
	{
		id: "importSplitChoice",
		area: "files",
		atom: importSplitChoiceEnabledAtom,
		Row: ImportSplitChoiceSetting,
		classicRow: ImportSplitChoiceSetting,
		resettable: true,
	},
	{
		id: "projectsHub",
		area: "files",
		atom: projectsHubEnabledAtom,
		Row: ProjectsHubToggle,
		classicRow: ProjectsHubToggle,
		resettable: true,
	},
	{
		id: "keyboardView",
		area: "keybinding",
		atom: keyboardViewEnabledAtom,
		Row: inlineFlagRow(keyboardViewEnabledAtom, <Keyboard12324Regular />, [
			"keyboardView.flagTitle",
			"Keyboard view and second keys",
			"keyboardView.flagDesc",
			"Experimental. Shows your shortcuts on a keyboard and lets one action have more than one key.",
		]),
		// The shell's Shortcuts page shows the keyboard itself, not this section.
		classicRow: KeyboardViewSection,
		resettable: true,
	},
];

/** What the shell's regular pages hide, so each flag shows only once. */
export const RELOCATED_SETTINGS: ReadonlySet<unknown> = new Set(
	EXPERIMENTAL_FLAGS.map((flag) => flag.classicRow),
);

/** Turns every resettable flag in a group back to its default (off). */
const TurnAllOff = ({
	flags,
	areaLabel,
}: {
	flags: readonly ExperimentalFlag[];
	areaLabel: string;
}) => {
	const { t } = useTranslation();
	const resettable = useMemo(
		() => flags.filter((flag) => flag.resettable).map((flag) => flag.atom),
		[flags],
	);
	const anyOnAtom = useMemo(
		() => atom((get) => resettable.some((setting) => get(setting))),
		[resettable],
	);
	const resetAtom = useMemo(
		() =>
			atom(null, (_get, set) => {
				for (const setting of resettable) set(setting, RESET);
			}),
		[resettable],
	);
	const anyOn = useAtomValue(anyOnAtom);
	const reset = useSetAtom(resetAtom);
	if (resettable.length === 0) return null;
	return (
		<Button
			size="1"
			variant="soft"
			color="gray"
			disabled={!anyOn}
			onClick={reset}
			data-turn-all-off=""
			aria-label={t(
				"preferencesPages.turnAllOffLabel",
				"Turn off every experimental feature under {area}",
				{ area: areaLabel },
			)}
		>
			{t("preferencesPages.turnAllOff", "Turn all off")}
		</Button>
	);
};

/**
 * The Experimental page: every flag under a heading for the page its feature
 * belongs to, with a reset per group. `areaLabels` holds those page names.
 */
export const ExperimentalPage = ({
	areaLabels,
}: {
	areaLabels: Record<ExperimentalArea, string>;
}) => {
	const areas = useMemo(() => {
		const byArea = new Map<ExperimentalArea, ExperimentalFlag[]>();
		for (const flag of EXPERIMENTAL_FLAGS) {
			const list = byArea.get(flag.area) ?? [];
			list.push(flag);
			byArea.set(flag.area, list);
		}
		return [...byArea];
	}, []);
	return (
		<Flex direction="column" gap="5">
			{areas.map(([area, flags]) => (
				<Flex
					key={area}
					asChild
					direction="column"
					gap="3"
					data-experimental-area={area}
				>
					<section>
						<SectionHeader
							title={areaLabels[area]}
							actions={
								<TurnAllOff flags={flags} areaLabel={areaLabels[area]} />
							}
						/>
						{flags.map(({ id, Row }) => (
							<Row key={id} />
						))}
					</section>
				</Flex>
			))}
		</Flex>
	);
};
