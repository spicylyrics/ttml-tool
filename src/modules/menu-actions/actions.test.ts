import { createStore } from "jotai";
import { beforeAll, describe, expect, it, vi } from "vitest";
import en from "$/i18n/locales/en-US/translation.json";
import type { LyricLine } from "$/types/ttml";
import type { MenuAction, MenuActionContext } from "./actions";

let actions: typeof import("./actions");
let ribbon: typeof import("./ribbon-actions");
let all: typeof import("./all-actions");
let registry: typeof import("$/modules/keyboard/registry");
let conflicts: typeof import("$/modules/keyboard/conflicts");
let palette: typeof import("$/modules/command-palette/palette-commands");
let main: typeof import("$/states/main");
let dialogs: typeof import("$/states/dialogs");
let ttml: typeof import("$/types/ttml");
let sync: typeof import("$/modules/settings/states/sync");
let editAsText: typeof import("$/modules/edit-as-text/states");
let sectionActions: typeof import("./section-actions");
let sectionStates: typeof import("$/modules/lyric-editor/states/sections");

beforeAll(async () => {
	const storage = new Map<string, string>();
	const localStorage = {
		getItem: (name: string) => storage.get(name) ?? null,
		setItem: (name: string, value: string) => storage.set(name, value),
		removeItem: (name: string) => storage.delete(name),
	};
	vi.stubGlobal("window", Object.assign(new EventTarget(), { localStorage }));
	vi.stubGlobal("localStorage", localStorage);
	vi.stubGlobal("navigator", { userAgent: "Windows" });
	actions = await import("./actions");
	ribbon = await import("./ribbon-actions");
	all = await import("./all-actions");
	registry = await import("$/modules/keyboard/registry");
	conflicts = await import("$/modules/keyboard/conflicts");
	palette = await import("$/modules/command-palette/palette-commands");
	main = await import("$/states/main");
	dialogs = await import("$/states/dialogs");
	ttml = await import("$/types/ttml");
	sync = await import("$/modules/settings/states/sync");
	editAsText = await import("$/modules/edit-as-text/states");
	sectionActions = await import("./section-actions");
	sectionStates = await import("$/modules/lyric-editor/states/sections");
});

function hasKey(key: string): boolean {
	let node: unknown = en;
	for (const part of key.split(".")) {
		if (typeof node !== "object" || node === null || !(part in node))
			return false;
		node = (node as Record<string, unknown>)[part];
	}
	return typeof node === "string";
}

function storeWithLines(lines: LyricLine[]) {
	const store = createStore();
	store.set(main.lyricLinesAtom, {
		...store.get(main.lyricLinesAtom),
		lyricLines: lines,
	});
	return store;
}

function lineWithWords(count: number): LyricLine {
	const line = ttml.newLyricLine();
	line.words = Array.from({ length: count }, () => ttml.newLyricWord());
	return line;
}

const context = (
	store: ReturnType<typeof createStore>,
	loadAudio: () => unknown = () => {},
) =>
	({
		store,
		t: (_key: string, fallback: string) => fallback,
		menu: {},
		loadAudio,
	}) as unknown as MenuActionContext;

const isEnabled = (
	action: MenuAction,
	store: ReturnType<typeof createStore>,
) => (action.enabledAtom ? store.get(action.enabledAtom) : true);

describe("menu actions as keyboard commands", () => {
	it("registers every action, so Preferences > Shortcuts and the palette list it", () => {
		for (const action of all.ACTION_LIST) {
			expect(registry.getCommandById(action.command.id)).toBe(action.command);
		}
		const ids = all.ACTION_LIST.map((action) => action.command.id);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("gives new commands no default key and no conflicts", () => {
		for (const action of all.ACTION_LIST) {
			if (!action.boundElsewhere)
				expect(action.command.defaultKeys, action.command.id).toEqual([]);
		}
		expect(
			conflicts.findKeyBindingConflicts(
				registry
					.getAllCommands()
					.map((command) => ({ command, keys: command.defaultKeys })),
			),
		).toEqual(new Map());
	});

	it("describes each command with text that exists in en-US", () => {
		for (const action of all.ACTION_LIST) {
			expect(hasKey(action.command.description), action.command.id).toBe(true);
			expect(
				hasKey(
					`settingsDialog.keybindings.category.${action.command.category}`,
				),
				action.command.category,
			).toBe(true);
		}
	});

	it("uses the control's label as the description, except where it needs its surroundings", () => {
		const keyOnly = (key: string) => key;
		const differs = all.ACTION_LIST.filter(
			(action) =>
				!action.boundElsewhere &&
				action.label(keyOnly) !== action.command.description,
		).map((action) => action.command.id);
		expect(differs.sort()).toEqual(
			[
				"exportAss",
				"exportEslrc",
				"exportLrc",
				"exportLys",
				"exportQrc",
				"exportTtml",
				"exportYrc",
				"newLyricLine",
				"toggleAdvancedRibbonControls",
			].sort(),
		);
		expect(en.settingsDialog.keybindings.exportLrc).toBe("Export lyrics: LRC");
	});

	it("lists the selection actions in Edit and Time mode, not Preview", () => {
		const { swapDuetSelected, combineWords, swapDuetAll } =
			actions.MENU_ACTIONS;
		const { lineBackground, lineDuet } = ribbon.RIBBON_ACTIONS;
		for (const action of [
			swapDuetSelected,
			combineWords,
			lineBackground,
			lineDuet,
		]) {
			for (const mode of ["edit", "sync"])
				expect(palette.paletteListsCommand(action.command, mode)).toBe(true);
			expect(palette.paletteListsCommand(action.command, "preview")).toBe(
				false,
			);
		}
		expect(palette.paletteListsCommand(swapDuetAll.command, "preview")).toBe(
			true,
		);
	});
});

describe("enabled rules", () => {
	it("greys out Swap main and duet lines with no lines", () => {
		const { swapDuetAll } = actions.MENU_ACTIONS;
		expect(isEnabled(swapDuetAll, storeWithLines([]))).toBe(false);
		expect(isEnabled(swapDuetAll, storeWithLines([lineWithWords(1)]))).toBe(
			true,
		);
	});

	it("needs selected lines to swap the selection", () => {
		const line = lineWithWords(1);
		const store = storeWithLines([line]);
		expect(isEnabled(actions.MENU_ACTIONS.swapDuetSelected, store)).toBe(false);
		store.set(main.selectedLinesAtom, new Set([line.id]));
		expect(isEnabled(actions.MENU_ACTIONS.swapDuetSelected, store)).toBe(true);
	});

	it("needs two or more words in one line to combine", () => {
		const first = lineWithWords(3);
		const second = lineWithWords(1);
		const store = storeWithLines([first, second]);
		const { combineWords } = actions.MENU_ACTIONS;
		store.set(main.selectedLinesAtom, new Set([first.id]));
		store.set(main.selectedWordsAtom, new Set([first.words[0].id]));
		expect(isEnabled(combineWords, store)).toBe(false);
		store.set(
			main.selectedWordsAtom,
			new Set([first.words[0].id, first.words[1].id]),
		);
		expect(isEnabled(combineWords, store)).toBe(true);
		store.set(main.selectedLinesAtom, new Set([first.id, second.id]));
		expect(isEnabled(combineWords, store)).toBe(false);
	});
});

describe("runMenuAction", () => {
	it("does nothing while the action is greyed out", () => {
		const store = storeWithLines([]);
		const run = vi.fn();
		actions.runMenuAction(
			{ ...actions.MENU_ACTIONS.swapDuetAll, run },
			context(store),
		);
		expect(run).not.toHaveBeenCalled();
	});

	it("does nothing outside its command's modes", () => {
		const line = lineWithWords(2);
		const store = storeWithLines([line]);
		store.set(main.selectedLinesAtom, new Set([line.id]));
		store.set(main.toolModeAtom, main.ToolMode.Preview);
		const run = vi.fn();
		actions.runMenuAction(
			{ ...actions.MENU_ACTIONS.swapDuetSelected, run },
			context(store),
		);
		expect(run).not.toHaveBeenCalled();
		store.set(main.toolModeAtom, main.ToolMode.Sync);
		actions.runMenuAction(
			{ ...actions.MENU_ACTIONS.swapDuetSelected, run },
			context(store),
		);
		expect(run).toHaveBeenCalledOnce();
	});

	it("does nothing while hidden, like Projects with folder projects off", () => {
		const run = vi.fn();
		actions.runMenuAction(
			{ ...actions.MENU_ACTIONS.projects, run },
			context(createStore()),
		);
		expect(run).not.toHaveBeenCalled();
	});

	it("swaps every line, or only the selected ones", () => {
		const first = lineWithWords(1);
		const second = lineWithWords(1);
		const store = storeWithLines([first, second]);
		actions.runMenuAction(actions.MENU_ACTIONS.swapDuetAll, context(store));
		expect(
			store.get(main.lyricLinesAtom).lyricLines.map((line) => line.isDuet),
		).toEqual([true, true]);
		store.set(main.selectedLinesAtom, new Set([second.id]));
		actions.runMenuAction(
			actions.MENU_ACTIONS.swapDuetSelected,
			context(store),
		);
		expect(
			store.get(main.lyricLinesAtom).lyricLines.map((line) => line.isDuet),
		).toEqual([true, false]);
	});

	it("opens Combine words for the selected words' line", () => {
		const first = lineWithWords(1);
		const second = lineWithWords(2);
		const store = storeWithLines([first, second]);
		store.set(main.selectedLinesAtom, new Set([second.id]));
		store.set(
			main.selectedWordsAtom,
			new Set(second.words.map((word) => word.id)),
		);
		actions.runMenuAction(actions.MENU_ACTIONS.combineWords, context(store));
		expect(store.get(dialogs.combineWordsDialogAtom)).toEqual({
			open: true,
			lineIndex: 1,
		});
	});

	it("opens dialogs and flips toggles", () => {
		const store = createStore();
		actions.runMenuAction(actions.MENU_ACTIONS.editAsText, context(store));
		expect(store.get(editAsText.editAsTextDialogAtom)).toBe(true);
		actions.runMenuAction(actions.MENU_ACTIONS.importLyrics, context(store));
		expect(store.get(dialogs.importLyricsDialogAtom)).toBe(true);
		const before = store.get(sync.spectrogramHoverSyncEnabledAtom);
		actions.runMenuAction(
			actions.MENU_ACTIONS.spectrogramHoverSync,
			context(store),
		);
		expect(store.get(sync.spectrogramHoverSyncEnabledAtom)).toBe(!before);
	});
});

describe("ribbon actions", () => {
	it("keeps each ribbon's toggles to its mode, so same-named ones don't clash", () => {
		const { editAutoScroll, syncAutoScroll, timingAutoScroll } =
			ribbon.RIBBON_ACTIONS;
		expect(editAutoScroll.command.modes).toEqual(["edit"]);
		expect(syncAutoScroll.command.modes).toEqual(["sync"]);
		expect(timingAutoScroll.command.modes).toEqual(["preview"]);
		expect(syncAutoScroll.command.category).toBe("Sync");
		expect(timingAutoScroll.command.category).toBe("Preview");
	});

	it("flips a ribbon setting", () => {
		const store = createStore();
		store.set(main.toolModeAtom, main.ToolMode.Sync);
		const { showTimestamps } = ribbon.RIBBON_ACTIONS;
		const before = store.get(showTimestamps.setting);
		actions.runMenuAction(showTimestamps, context(store));
		expect(store.get(showTimestamps.setting)).toBe(!before);
		store.set(main.toolModeAtom, main.ToolMode.Edit);
		actions.runMenuAction(showTimestamps, context(store));
		expect(store.get(showTimestamps.setting)).toBe(!before);
	});

	it("sets a line flag on every selected line unless all have it, like the checkbox", () => {
		const first = lineWithWords(1);
		const second = lineWithWords(1);
		second.isBG = true;
		const store = storeWithLines([first, second]);
		const { lineBackground } = ribbon.RIBBON_ACTIONS;
		expect(isEnabled(lineBackground, store)).toBe(false);
		store.set(main.selectedLinesAtom, new Set([first.id, second.id]));
		const bg = () =>
			store.get(main.lyricLinesAtom).lyricLines.map((line) => line.isBG);
		actions.runMenuAction(lineBackground, context(store));
		expect(bg()).toEqual([true, true]);
		actions.runMenuAction(lineBackground, context(store));
		expect(bg()).toEqual([false, false]);
	});

	it("adds a lyric line and loads audio", () => {
		const store = storeWithLines([]);
		actions.runMenuAction(ribbon.RIBBON_ACTIONS.newLyricLine, context(store));
		expect(store.get(main.lyricLinesAtom).lyricLines).toHaveLength(1);
		const loadAudio = vi.fn();
		actions.runMenuAction(
			ribbon.RIBBON_ACTIONS.loadAudio,
			context(store, loadAudio),
		);
		expect(loadAudio).toHaveBeenCalledOnce();
	});
});

describe("section actions", () => {
	function storeWithSections() {
		const lines = [lineWithWords(1), lineWithWords(1), lineWithWords(1)];
		lines[0].sectionId = "verse";
		lines[0].geniusHeader = "[Verse 1]";
		lines[1].sectionId = "verse";
		lines[2].sectionId = "chorus";
		lines[2].geniusHeader = "[Chorus]";
		const store = storeWithLines(lines);
		store.set(main.lyricLinesAtom, {
			...store.get(main.lyricLinesAtom),
			sections: [
				{ id: "verse", label: "[Verse 1]", category: "verse" },
				{ id: "chorus", label: "[Chorus]", category: "chorus" },
			],
		});
		return { store, lines };
	}

	it("acts on the section the selection starts in", () => {
		const { store, lines } = storeWithSections();
		const { sectionRename, sectionMergePrevious, sectionStartHere } =
			sectionActions.SECTION_ACTIONS;
		expect(isEnabled(sectionRename, store)).toBe(false);
		store.set(main.selectedLinesAtom, new Set([lines[2].id, lines[1].id]));
		actions.runMenuAction(sectionRename, context(store));
		expect(store.get(sectionStates.editingSectionIdAtom)).toBe("verse");
		// The verse is first, so there's nothing before it to merge into.
		expect(isEnabled(sectionMergePrevious, store)).toBe(false);
		expect(isEnabled(sectionStartHere, store)).toBe(true);
		store.set(main.selectedLinesAtom, new Set([lines[2].id]));
		expect(isEnabled(sectionStartHere, store)).toBe(false);
		actions.runMenuAction(sectionMergePrevious, context(store));
		expect(
			store.get(main.lyricLinesAtom).lyricLines.map((line) => line.sectionId),
		).toEqual(["verse", "verse", "verse"]);
	});

	it("keeps the timing tools to Time mode", () => {
		const { store, lines } = storeWithSections();
		const { sectionApplyTimings } = sectionActions.SECTION_ACTIONS;
		store.set(main.selectedLinesAtom, new Set([lines[2].id]));
		actions.runMenuAction(sectionApplyTimings, context(store));
		expect(store.get(sectionStates.applyTimingsSectionIdAtom)).toBeNull();
		store.set(main.toolModeAtom, main.ToolMode.Sync);
		actions.runMenuAction(sectionApplyTimings, context(store));
		expect(store.get(sectionStates.applyTimingsSectionIdAtom)).toBe("chorus");
	});
});
