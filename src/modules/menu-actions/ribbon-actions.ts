import { atom, type WritableAtom } from "jotai";
import { withImmer } from "jotai-immer";
import {
	applySelectedField,
	getSelectedFieldValue,
} from "$/components/RibbonBar/fields/selection-values";
import { t as key } from "$/modules/keyboard/i18n-helper";
import type { I18nKey, KeyBindingMode } from "$/modules/keyboard/types";
import { advancedRibbonControlsAtom } from "$/modules/onboarding/states";
import {
	displayRomanizationInSyncAtom,
	highlightErrorsAtom,
	showLineRomanizationAtom,
	showLineTranslationAtom,
	showTimestampsAtom,
	showWordRomanizationInputAtom,
} from "$/modules/settings/states/index.ts";
import {
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicyForceLineSyncedAtom,
	spicyJoinSplitWordsAtom,
	spicySimpleLyricsModeAtom,
} from "$/modules/settings/states/preview";
import {
	editActiveLineHighlightAtom,
	editAutoScrollAtom,
	showTouchSyncPanelAtom,
	syncActiveLineHighlightAtom,
	syncAutoScrollAtom,
	timingOverviewAutoScrollAtom,
} from "$/modules/settings/states/sync.ts";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	showPreviewPanelAtom,
} from "$/states/main.ts";
import { type LyricLine, newLyricLine } from "$/types/ttml";
import { defineAction, type MenuAction, SELECTION_MODES } from "./actions";

type BooleanSetting = WritableAtom<boolean, [boolean], unknown>;

export type ToggleAction = MenuAction & { setting: BooleanSetting };

/** A ribbon switch as a command: running it flips the setting. */
function defineToggle(
	id: string,
	category: "Edit" | "Sync" | "Preview" | "View",
	label: [I18nKey, string],
	setting: BooleanSetting,
	options: { modes?: readonly KeyBindingMode[]; description?: I18nKey } = {},
): ToggleAction {
	return {
		...defineAction(id, category, label, {
			...options,
			checkedAtom: setting,
			run: ({ store }) => store.set(setting, !store.get(setting)),
		}),
		setting,
	};
}

const hasSelectedLinesAtom = atom((get) => get(selectedLinesAtom).size > 0);
const lyricLinesImmerAtom = withImmer(lyricLinesAtom);

type LineFlag = "isBG" | "isDuet" | "ignoreSync";

/** Like clicking the ribbon checkbox: on unless every selected line already has it. */
function lineFlagAction(
	id: string,
	label: [I18nKey, string],
	field: LineFlag,
): MenuAction {
	return defineAction(id, "Edit", label, {
		modes: SELECTION_MODES,
		enabledAtom: hasSelectedLinesAtom,
		run: ({ store }) => {
			const selected = store.get(selectedLinesAtom);
			const lines = store.get(lyricLinesAtom).lyricLines;
			const current = getSelectedFieldValue<LyricLine, LineFlag>(
				lines,
				selected,
				false,
				field,
				(value) => value,
			);
			store.set(lyricLinesImmerAtom, (draft) => {
				draft.lyricLines = applySelectedField<LyricLine, LineFlag>(
					draft.lyricLines,
					selected,
					false,
					field,
					current !== true,
				);
			});
		},
	});
}

const EDIT: { modes: readonly KeyBindingMode[] } = { modes: ["edit"] };
const SYNC: { modes: readonly KeyBindingMode[] } = { modes: ["sync"] };
const PREVIEW: { modes: readonly KeyBindingMode[] } = { modes: ["preview"] };

export const RIBBON_ACTIONS = {
	// Edit ribbon
	newLyricLine: defineAction(
		"newLyricLine",
		"Edit",
		[key("ribbonBar.editMode.lyricLine"), "Lyric line"],
		{
			...EDIT,
			description: key("settingsDialog.keybindings.newLyricLine"),
			run: ({ store }) =>
				store.set(lyricLinesImmerAtom, (draft) => {
					draft.lyricLines.push(newLyricLine());
				}),
		},
	),
	editAutoScroll: defineToggle(
		"editAutoScroll",
		"Edit",
		[key("ribbonBar.editMode.autoScroll"), "Auto-scroll"],
		editAutoScrollAtom,
		EDIT,
	),
	editHighlightLine: defineToggle(
		"editHighlightLine",
		"Edit",
		[key("ribbonBar.editMode.highlightActiveLine"), "Highlight line"],
		editActiveLineHighlightAtom,
		EDIT,
	),
	lineBackground: lineFlagAction(
		"toggleLineBackground",
		[key("ribbonBar.editMode.bgLyric"), "Background vocal"],
		"isBG",
	),
	lineDuet: lineFlagAction(
		"toggleLineDuet",
		[key("ribbonBar.editMode.duetLyric"), "Duet vocal"],
		"isDuet",
	),
	lineIgnoreSync: lineFlagAction(
		"toggleLineIgnoreSync",
		[key("ribbonBar.editMode.ignoreSync"), "Skip when syncing"],
		"ignoreSync",
	),
	showLineTranslation: defineToggle(
		"showLineTranslation",
		"Edit",
		[key("ribbonBar.editMode.showTranslation"), "Show translation line"],
		showLineTranslationAtom,
		EDIT,
	),
	showLineRomanization: defineToggle(
		"showLineRomanization",
		"Edit",
		[key("ribbonBar.editMode.showRomanization"), "Show romanization line"],
		showLineRomanizationAtom,
		EDIT,
	),
	showWordRomanizationInput: defineToggle(
		"showWordRomanizationInput",
		"Edit",
		[
			key("ribbonBar.editMode.showWordRomanizationInput"),
			"Show per-word romanization",
		],
		showWordRomanizationInputAtom,
		EDIT,
	),

	// Time ribbon. Sync is the Shortcuts page's Timing group.
	syncAutoScroll: defineToggle(
		"syncAutoScroll",
		"Sync",
		[key("ribbonBar.syncMode.autoScroll"), "Auto-scroll"],
		syncAutoScrollAtom,
		SYNC,
	),
	syncHighlightLine: defineToggle(
		"syncHighlightLine",
		"Sync",
		[key("ribbonBar.syncMode.highlightActiveLine"), "Highlight line"],
		syncActiveLineHighlightAtom,
		SYNC,
	),
	previewPanel: defineToggle(
		"togglePreviewPanel",
		"Sync",
		[key("ribbonBar.editMode.previewPanel"), "Preview panel"],
		showPreviewPanelAtom,
		SYNC,
	),
	touchSyncPanel: defineToggle(
		"toggleTouchSyncPanel",
		"Sync",
		[key("ribbonBar.syncMode.touchSyncPanel"), "Touch sync panel"],
		showTouchSyncPanelAtom,
		SYNC,
	),
	showTimestamps: defineToggle(
		"toggleTimestamps",
		"Sync",
		[key("ribbonBar.syncMode.showTimestamps"), "Show timestamps"],
		showTimestampsAtom,
		SYNC,
	),
	highlightErrors: defineToggle(
		"toggleHighlightErrors",
		"Sync",
		[key("ribbonBar.syncMode.highlightErrors"), "Highlight errors"],
		highlightErrorsAtom,
		SYNC,
	),
	syncWordRomanization: defineToggle(
		"toggleSyncWordRomanization",
		"Sync",
		[
			key("ribbonBar.syncMode.showPerWordRomanization"),
			"Show per-word romanization",
		],
		displayRomanizationInSyncAtom,
		SYNC,
	),

	// Preview ribbon
	simpleLyricsMode: defineToggle(
		"toggleSimpleLyricsMode",
		"Preview",
		[key("ribbonBar.previewMode.simpleLyrics"), "Simple Lyrics mode"],
		spicySimpleLyricsModeAtom,
		PREVIEW,
	),
	forceLineSynced: defineToggle(
		"toggleForceLineSynced",
		"Preview",
		[key("ribbonBar.previewMode.forceLineRendering"), "Show as line-synced"],
		spicyForceLineSyncedAtom,
		PREVIEW,
	),
	timingAutoScroll: defineToggle(
		"previewAutoScroll",
		"Preview",
		[key("ribbonBar.previewMode.autoScroll"), "Auto-scroll"],
		timingOverviewAutoScrollAtom,
		PREVIEW,
	),
	previewTranslation: defineToggle(
		"togglePreviewTranslation",
		"Preview",
		[key("ribbonBar.previewMode.showTranslation"), "Show translation"],
		showTranslationLinesAtom,
		PREVIEW,
	),
	previewRomanization: defineToggle(
		"togglePreviewRomanization",
		"Preview",
		[key("ribbonBar.previewMode.showRoman"), "Show romanization"],
		showRomanLinesAtom,
		PREVIEW,
	),
	joinSplitWords: defineToggle(
		"toggleJoinSplitWords",
		"Preview",
		[key("joinSplitWords.label"), "Join split words"],
		spicyJoinSplitWordsAtom,
		PREVIEW,
	),

	// Shared by all three ribbons
	advancedControls: defineToggle(
		"toggleAdvancedRibbonControls",
		"View",
		[key("ribbonBar.advanced"), "Advanced"],
		advancedRibbonControlsAtom,
		{ description: key("settingsDialog.keybindings.advancedRibbonControls") },
	),

	// The spectrogram's and audio menu's Load audio file button
	loadAudio: defineAction(
		"loadAudio",
		"Audio",
		[key("spectrogram.loadAudio"), "Load audio file"],
		{ run: ({ loadAudio }) => loadAudio() },
	),
} satisfies Record<string, MenuAction>;
