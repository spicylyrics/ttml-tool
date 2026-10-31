import { type Atom, atom, type createStore } from "jotai";
import type { useTopMenuActions } from "$/components/TopMenu/useTopMenuActions";
import { editAsTextDialogAtom } from "$/modules/edit-as-text/states";
import {
	cmdAutoSegmentDialog,
	cmdDeleteSelection,
	cmdNewFile,
	cmdOpenFile,
	cmdRedo,
	cmdSaveFile,
	cmdSelectAll,
	cmdUndo,
	cmdUnselectAll,
} from "$/modules/keyboard/commands";
import { t as key } from "$/modules/keyboard/i18n-helper";
import { registerCommand } from "$/modules/keyboard/registry";
import type {
	I18nKey,
	KeyBindingCommand,
	KeyBindingMode,
} from "$/modules/keyboard/types";
import { clearWordTiming } from "$/modules/lyric-editor/utils/clear-word-timing";
import { swapDuetLinesAtom } from "$/modules/lyric-editor/utils/swap-duet";
import { guideWelcomeOpenAtom } from "$/modules/onboarding/states";
import type { LyricExportFormat } from "$/modules/project/export-lyric";
import { folderProjectsEnabledAtom } from "$/modules/settings/states";
import { spectrogramHoverSyncEnabledAtom } from "$/modules/settings/states/sync";
import {
	canCombineNextAtom,
	canCombinePreviousAtom,
	combineSelectedWord,
	hasSelectedWordAtom,
	openReplaceSelectedWord,
	openSplitSelectedWord,
} from "$/modules/time-mode-editing/word-actions";
import {
	changelogDialogAtom,
	combineWordsDialogAtom,
	geniusSearchDialogAtom,
	importLyricsDialogAtom,
	settingsDialogAtom,
	settingsTabAtom,
} from "$/states/dialogs.ts";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	toolModeAtom,
} from "$/states/main.ts";

type Store = ReturnType<typeof createStore>;
export type Translate = (key: string, fallback: string) => string;

export interface MenuActionContext {
	store: Store;
	t: Translate;
	menu: ReturnType<typeof useTopMenuActions>;
	loadAudio: () => unknown;
}

/**
 * One action from the top menus, the ribbons or the right-click selection
 * tools, defined once. Each is a keyboard command, so it can be given a key
 * in Preferences and the command palette lists it; the control, the
 * shortcut and the palette share the label, the enabled rule and what it runs.
 */
export interface MenuAction {
	command: KeyBindingCommand;
	/** The command existed before and its shortcut is handled elsewhere (the top bar). */
	boundElsewhere?: boolean;
	/** The menu item's label. The command's description is the same text unless the menu's only makes sense in its submenu, e.g. "LRC". */
	label: (t: Translate) => string;
	/** Left out of the palette because a Preferences page already covers it. */
	paletteHidden?: boolean;
	enabledAtom?: Atom<boolean>;
	visibleAtom?: Atom<boolean>;
	/** Set for toggles: the menu shows a checkbox and the palette a check mark. */
	checkedAtom?: Atom<boolean>;
	/** May return a promise; what it resolves to is ignored. */
	run: (context: MenuActionContext) => unknown;
}

type Category =
	| "File"
	| "Edit"
	| "View"
	| "Sync"
	| "Audio"
	| "Preview"
	| "Tools"
	| "Help";

/** Registers a command with no default key, described by the control's label unless `description` says otherwise. */
export function defineAction(
	id: string,
	category: Category,
	label: [I18nKey, string],
	action: Omit<MenuAction, "command" | "label"> & {
		modes?: readonly KeyBindingMode[];
		description?: I18nKey;
	},
): MenuAction {
	const { modes, description, ...rest } = action;
	return {
		command: registerCommand(id, [], description ?? label[0], category, modes),
		label: (t) => t(label[0], label[1]),
		...rest,
	};
}

/** Edit and Time mode, where lines and words can be selected. */
export const SELECTION_MODES: readonly KeyBindingMode[] = ["edit", "sync"];

const hasLyricLinesAtom = atom(
	(get) => get(lyricLinesAtom).lyricLines.length > 0,
);
const hasSelectedLinesAtom = atom((get) => get(selectedLinesAtom).size > 0);
/** Combine words works on two or more words in one line, like its right-click item. */
const canCombineWordsAtom = atom(
	(get) => get(selectedWordsAtom).size > 1 && get(selectedLinesAtom).size === 1,
);
const hasSelectionAtom = atom(
	(get) => get(selectedWordsAtom).size > 0 || get(selectedLinesAtom).size > 0,
);

const exportAction = (
	id: string,
	format: LyricExportFormat,
	label: [I18nKey, string],
	description: I18nKey,
) =>
	defineAction(id, "File", label, {
		description,
		// Loaded on use: the stringifiers aren't needed until someone exports.
		run: ({ store, t }) =>
			import("$/modules/project/export-lyric").then(({ exportLyric }) =>
				exportLyric(store, t, format),
			),
	});

export const MENU_ACTIONS = {
	// File
	newFile: {
		command: cmdNewFile,
		boundElsewhere: true,
		label: (t) => t("topBar.menu.newLyric", "New TTML file"),
		run: ({ menu }) => menu.onNewFile(),
	},
	openFile: {
		command: cmdOpenFile,
		boundElsewhere: true,
		label: (t) => t("topBar.menu.openLyric", "Open TTML file"),
		run: ({ menu }) => menu.onOpenFile(),
	},
	openFromClipboard: defineAction(
		"openFromClipboard",
		"File",
		[key("topBar.menu.openFromClipboard"), "Open TTML file from clipboard"],
		{ run: ({ menu }) => menu.onOpenFileFromClipboard() },
	),
	saveFile: {
		command: cmdSaveFile,
		boundElsewhere: true,
		label: (t) => t("topBar.menu.saveLyric", "Save TTML file"),
		run: ({ menu }) => menu.onSaveFile(),
	},
	projects: defineAction(
		"openProjects",
		"File",
		[key("topBar.menu.projects"), "Projects"],
		{
			visibleAtom: folderProjectsEnabledAtom,
			run: ({ menu }) => menu.onOpenProjects(),
		},
	),
	restoreFromHistory: defineAction(
		"restoreFromHistory",
		"File",
		[key("topBar.menu.restoreFromHistory"), "Restore from history..."],
		{ run: ({ menu }) => menu.onOpenHistoryRestore() },
	),
	saveToClipboard: defineAction(
		"saveToClipboard",
		"File",
		[key("topBar.menu.saveLyricToClipboard"), "Save TTML file to clipboard"],
		{ run: ({ menu }) => menu.onSaveFileToClipboard() },
	),
	importLyrics: defineAction(
		"importLyrics",
		"File",
		[key("topBar.menu.importLyric.import"), "Import lyrics..."],
		{ run: ({ store }) => store.set(importLyricsDialogAtom, true) },
	),
	exportTtml: defineAction(
		"exportTtml",
		"File",
		[key("topBar.menu.exportLyric.toTTML"), "TTML"],
		{
			description: key("settingsDialog.keybindings.exportTtml"),
			run: ({ menu }) => menu.onSaveFile(),
		},
	),
	exportLrc: exportAction(
		"exportLrc",
		"lrc",
		[key("topBar.menu.exportLyric.toLRC"), "LRC"],
		key("settingsDialog.keybindings.exportLrc"),
	),
	exportEslrc: exportAction(
		"exportEslrc",
		"eslrc",
		[key("topBar.menu.exportLyric.toESLRC"), "ESLRC"],
		key("settingsDialog.keybindings.exportEslrc"),
	),
	exportQrc: exportAction(
		"exportQrc",
		"qrc",
		[key("topBar.menu.exportLyric.toQRC"), "QRC"],
		key("settingsDialog.keybindings.exportQrc"),
	),
	exportYrc: exportAction(
		"exportYrc",
		"yrc",
		[key("topBar.menu.exportLyric.toYRC"), "YRC"],
		key("settingsDialog.keybindings.exportYrc"),
	),
	exportLys: exportAction(
		"exportLys",
		"lys",
		[key("topBar.menu.exportLyric.toLrcfySylb"), "Lyricify Syllable"],
		key("settingsDialog.keybindings.exportLys"),
	),
	exportAss: exportAction(
		"exportAss",
		"ass",
		[key("topBar.menu.exportLyric.toASS"), "ASS subtitles"],
		key("settingsDialog.keybindings.exportAss"),
	),

	// Edit
	undo: {
		command: cmdUndo,
		boundElsewhere: true,
		label: (t) => t("topBar.menu.undo", "Undo"),
		run: ({ menu }) => menu.onUndo(),
	},
	redo: {
		command: cmdRedo,
		boundElsewhere: true,
		label: (t) => t("topBar.menu.redo", "Redo"),
		run: ({ menu }) => menu.onRedo(),
	},
	selectAll: {
		command: cmdSelectAll,
		boundElsewhere: true,
		label: (t) => t("topBar.menu.selectAllLines", "Select all lines"),
		run: ({ menu }) => menu.onSelectAll(),
	},
	unselectAll: {
		command: cmdUnselectAll,
		boundElsewhere: true,
		label: (t) => t("topBar.menu.unselectAllLines", "Unselect all lines"),
		run: ({ menu }) => menu.onUnselectAll(),
	},
	deleteSelection: {
		command: cmdDeleteSelection,
		boundElsewhere: true,
		label: (t) =>
			t("settingsDialog.keybindings.deleteSelection", "Delete selection"),
		run: ({ menu }) => menu.onDeleteSelection(),
	},
	timeShift: defineAction(
		"timeShift",
		"Edit",
		[key("topBar.menu.timeShift"), "Time shift..."],
		{ run: ({ menu }) => menu.onOpenTimeShift() },
	),
	timeStretch: defineAction(
		"timeStretch",
		"Edit",
		[key("topBar.menu.timeStretch"), "Time stretch..."],
		{ run: ({ menu }) => menu.onOpenTimeStretch() },
	),
	editMetadata: defineAction(
		"editMetadata",
		"Edit",
		[key("topBar.menu.editMetadata"), "Edit lyric metadata"],
		{ run: ({ menu }) => menu.onOpenMetadataEditor() },
	),
	editAsText: defineAction(
		"editAsText",
		"Edit",
		[key("editAsText.menuItem"), "Edit as text..."],
		{ run: ({ store }) => store.set(editAsTextDialogAtom, true) },
	),
	preferences: defineAction(
		"openPreferences",
		"Edit",
		[key("settingsDialog.title"), "Preferences"],
		{ run: ({ menu }) => menu.onOpenSettings() },
	),
	// Right-click selection actions; no menu item of their own up top. They
	// work on whatever is selected, so Time mode gets them too.
	swapDuetSelected: defineAction(
		"swapDuetSelected",
		"Edit",
		[key("editModeTools.swapDuetSelected"), "Swap main and duet"],
		{
			modes: SELECTION_MODES,
			enabledAtom: hasSelectedLinesAtom,
			run: ({ store }) =>
				store.set(swapDuetLinesAtom, store.get(selectedLinesAtom)),
		},
	),
	// An action rather than a timing key, so the palette lists it in Time mode.
	clearWordTiming: defineAction(
		"clearWordTiming",
		"Sync",
		[
			key("settingsDialog.keybindings.clearWordTiming"),
			"Timing - Clear word/syllable timestamps",
		],
		{
			modes: ["edit", "sync"],
			enabledAtom: hasSelectionAtom,
			run: ({ store }) =>
				store.set(lyricLinesAtom, (document) =>
					clearWordTiming(
						document,
						store.get(selectedWordsAtom),
						store.get(selectedLinesAtom),
					),
				),
		},
	),
	combineWords: defineAction(
		"combineWords",
		"Edit",
		[key("contextMenu.combineWords"), "Combine words"],
		{
			modes: SELECTION_MODES,
			enabledAtom: canCombineWordsAtom,
			run: ({ store }) => {
				const selectedLines = store.get(selectedLinesAtom);
				const lineIndex = store
					.get(lyricLinesAtom)
					.lyricLines.findIndex((line) => selectedLines.has(line.id));
				if (lineIndex !== -1)
					store.set(combineWordsDialogAtom, { open: true, lineIndex });
			},
		},
	),
	// Time mode's right-click word items, on the word the sync cursor is on.
	// Edit rather than Sync: the palette leaves the Sync timing keys out.
	splitSelectedWord: defineAction(
		"splitSelectedWord",
		"Edit",
		[key("contextMenu.splitWord"), "Split word..."],
		{
			modes: ["sync"],
			enabledAtom: hasSelectedWordAtom,
			run: ({ store }) => openSplitSelectedWord(store),
		},
	),
	combineWithPreviousWord: defineAction(
		"combineWithPreviousWord",
		"Edit",
		[key("timeModeEditing.combinePrevious"), "Combine with previous word"],
		{
			modes: ["sync"],
			enabledAtom: canCombinePreviousAtom,
			run: ({ store }) => combineSelectedWord(store, "previous"),
		},
	),
	combineWithNextWord: defineAction(
		"combineWithNextWord",
		"Edit",
		[key("timeModeEditing.combineNext"), "Combine with next word"],
		{
			modes: ["sync"],
			enabledAtom: canCombineNextAtom,
			run: ({ store }) => combineSelectedWord(store, "next"),
		},
	),
	replaceSelectedWord: defineAction(
		"replaceSelectedWord",
		"Edit",
		[key("contextMenu.replaceWord"), "Replace word..."],
		{
			modes: ["sync"],
			enabledAtom: hasSelectedWordAtom,
			run: ({ store }) => openReplaceSelectedWord(store),
		},
	),

	// Tools
	autoSegment: {
		command: cmdAutoSegmentDialog,
		boundElsewhere: true,
		label: (t) => t("topBar.menu.autoSegment", "Auto segment..."),
		run: ({ menu }) => menu.onAutoSegment(),
	},
	advancedSegment: defineAction(
		"advancedSegmentation",
		"Tools",
		[key("topBar.menu.advancedSegment"), "Advanced segmentation..."],
		{ run: ({ menu }) => menu.onOpenAdvancedSegmentation() },
	),
	learnedSplits: defineAction(
		"learnedSplits",
		"Tools",
		[key("topBar.menu.learnedSplits"), "Learned splits..."],
		{ run: ({ menu }) => menu.onOpenLearnedSplits() },
	),
	syncLineTimestamps: defineAction(
		"syncLineTimestamps",
		"Tools",
		[key("topBar.menu.syncLineTimestamps"), "Fit lines to their words"],
		{ run: ({ menu }) => menu.onSyncLineTimestamps() },
	),
	swapDuetAll: defineAction(
		"swapDuetAll",
		"Tools",
		[key("editModeTools.swapDuetAll"), "Swap main and duet lines"],
		{
			enabledAtom: hasLyricLinesAtom,
			run: ({ store }) => store.set(swapDuetLinesAtom),
		},
	),
	spectrogramHoverSync: defineAction(
		"toggleSpectrogramHoverSync",
		"Tools",
		[key("topBar.menu.spectrogramHoverSync"), "Sync at mouse position"],
		{
			checkedAtom: spectrogramHoverSyncEnabledAtom,
			run: ({ store }) =>
				store.set(
					spectrogramHoverSyncEnabledAtom,
					!store.get(spectrogramHoverSyncEnabledAtom),
				),
		},
	),
	latencyTest: defineAction(
		"latencyTest",
		"Tools",
		[key("settingsDialog.common.latencyTest"), "Audio/input latency test"],
		{ run: ({ menu }) => menu.onOpenLatencyTest() },
	),
	ttmlChecklist: defineAction(
		"ttmlChecklist",
		"Tools",
		[key("topBar.menu.ttmlChecklist"), "TTML checklist"],
		{ run: ({ menu }) => menu.onOpenTTMLChecklist() },
	),
	// The metadata editor's Genius button.
	geniusSearch: defineAction(
		"geniusSearch",
		"Tools",
		[
			key("metadataDialog.fetchSongwriters.button"),
			"Fetch songwriters from Genius",
		],
		{ run: ({ store }) => store.set(geniusSearchDialogAtom, true) },
	),

	// Help
	startGuide: defineAction(
		"startGuide",
		"Help",
		[key("beginnerGuide.menu"), "Start guide"],
		{ run: ({ store }) => store.set(guideWelcomeOpenAtom, true) },
	),
	github: defineAction(
		"openGitHub",
		"Help",
		[key("aboutModal.github"), "Star on GitHub"],
		{ run: ({ menu }) => menu.onOpenGitHub() },
	),
	guides: defineAction(
		"openGuides",
		"Help",
		[key("topBar.menu.helpDoc"), "TTML guides"],
		{ run: ({ menu }) => menu.onOpenGuides() },
	),
	changelog: defineAction(
		"openChangelog",
		"Help",
		[key("topBar.menu.changelog"), "Changelog & updates"],
		{
			paletteHidden: true,
			run: ({ store }) => store.set(changelogDialogAtom, true),
		},
	),
	about: defineAction("openAbout", "Help", [key("common.about"), "About"], {
		paletteHidden: true,
		run: ({ store }) => {
			store.set(settingsTabAtom, "about");
			store.set(settingsDialogAtom, true);
		},
	}),
} satisfies Record<string, MenuAction>;

/**
 * Runs an action from its shortcut or the palette, with the menu's rules: only
 * in its command's modes, and not while it's hidden or greyed out.
 */
export function runMenuAction(action: MenuAction, context: MenuActionContext) {
	const { store } = context;
	if (
		!(action.command.modes as readonly string[]).includes(
			store.get(toolModeAtom),
		)
	)
		return;
	if (action.visibleAtom && !store.get(action.visibleAtom)) return;
	if (action.enabledAtom && !store.get(action.enabledAtom)) return;
	return action.run(context);
}
