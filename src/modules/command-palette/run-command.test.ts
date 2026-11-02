import { createStore } from "jotai";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";

let keyboard: typeof import("$/utils/keybindings");
let commands: typeof import("$/modules/keyboard/commands");
let registry: typeof import("$/modules/keyboard/registry");
let findConflicts: typeof import("$/modules/keyboard/conflicts").findKeyBindingConflicts;
let paletteCommands: typeof import("./palette-commands");
let runner: typeof import("./run-command");
const storage = new Map<string, string>();
const cleanups: Array<() => void> = [];

class TestKeyboardEvent extends Event {
	code: string;
	key: string;
	ctrlKey: boolean;
	metaKey: boolean;
	altKey: boolean;
	shiftKey: boolean;
	repeat = false;
	constructor(type: string, init: KeyboardEventInit = {}) {
		super(type, init);
		this.code = init.code ?? "";
		this.key = init.key ?? "";
		this.ctrlKey = !!init.ctrlKey;
		this.metaKey = !!init.metaKey;
		this.altKey = !!init.altKey;
		this.shiftKey = !!init.shiftKey;
	}
}

beforeAll(async () => {
	vi.stubGlobal("window", new EventTarget());
	vi.stubGlobal("document", { body: {}, activeElement: null });
	vi.stubGlobal("navigator", { userAgent: "Windows" });
	vi.stubGlobal("KeyboardEvent", TestKeyboardEvent);
	const localStorage = {
		getItem: (name: string) => storage.get(name) ?? null,
		setItem: (name: string, value: string) => storage.set(name, value),
		removeItem: (name: string) => storage.delete(name),
	};
	vi.stubGlobal("localStorage", localStorage);
	Object.assign(window, { localStorage });
	keyboard = await import("$/utils/keybindings");
	commands = await import("$/modules/keyboard/commands");
	registry = await import("$/modules/keyboard/registry");
	({ findKeyBindingConflicts: findConflicts } = await import(
		"$/modules/keyboard/conflicts"
	));
	paletteCommands = await import("./palette-commands");
	runner = await import("./run-command");
});

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	storage.clear();
});

describe("palette shortcuts", () => {
	it("registers Ctrl+K and Ctrl+Shift+P with the other commands, without default conflicts", () => {
		const open = registry.getCommandById("openCommandPalette");
		const alternate = registry.getCommandById("openCommandPaletteAlternate");
		expect(open).toBe(commands.cmdOpenCommandPalette);
		expect(alternate).toBe(commands.cmdOpenCommandPaletteAlternate);
		expect(open?.defaultKeys).toEqual(["Control", "KeyK"]);
		expect(alternate?.defaultKeys).toEqual(["Control", "Shift", "KeyP"]);
		expect(open?.category).toBe("View");
		expect(
			findConflicts(
				registry
					.getAllCommands()
					.map((command) => ({ command, keys: command.defaultKeys })),
			),
		).toEqual(new Map());
	});
});

describe("commandRunsInMode", () => {
	it("matches known modes and lists nothing for an unknown one", () => {
		const { commandRunsInMode } = paletteCommands;
		expect(commandRunsInMode(commands.cmdUndo, "edit")).toBe(true);
		expect(commandRunsInMode(commands.cmdSyncStart, "edit")).toBe(false);
		expect(commandRunsInMode(commands.cmdSyncStart, "sync")).toBe(true);
		expect(
			registry
				.getAllCommands()
				.filter((command) => commandRunsInMode(command, "transcribe")),
		).toEqual([]);
	});
});

describe("paletteListsCommand", () => {
	const listed = (mode: string) =>
		registry
			.getAllCommands()
			.filter((command) => paletteCommands.paletteListsCommand(command, mode));

	it("leaves sync commands out in Time mode and keeps the rest", () => {
		const sync = listed("sync");
		expect(sync.some(paletteCommands.isSyncCommand)).toBe(false);
		expect(sync).not.toContain(commands.cmdSyncStart);
		expect(sync).not.toContain(commands.cmdMoveNextWord);
		expect(sync).not.toContain(commands.cmdUrbanDictionarySync);
		expect(sync).toContain(commands.cmdPlayPause);
		expect(sync).toContain(commands.cmdUndo);
		expect(sync).toContain(commands.cmdSwitchEditMode);
		expect(sync).toContain(commands.cmdAuditionSelection);
	});

	it("never lists the palette's own shortcuts", () => {
		for (const mode of ["edit", "sync", "preview"]) {
			expect(listed(mode)).not.toContain(commands.cmdOpenCommandPalette);
			expect(listed(mode)).not.toContain(
				commands.cmdOpenCommandPaletteAlternate,
			);
		}
	});

	it("lists every other command that runs in the mode", () => {
		expect(listed("edit")).toContain(commands.cmdUrbanDictionary);
		expect(listed("edit")).not.toContain(commands.cmdSyncStart);
		expect(listed("preview")).toContain(commands.cmdPlayPause);
	});
});

describe("runKeyboardCommand", () => {
	it("calls atom handlers directly, once, without pressing keys", () => {
		const store = createStore();
		const atomHandler = vi.fn();
		const shortcutHandler = vi.fn();
		const keys = store.get(commands.cmdUndo.atom);
		cleanups.push(
			keyboard.registerKeyBindingAtom(commands.cmdUndo.atom, keys, atomHandler),
		);
		cleanups.push(keyboard.registerKeyBindings(["KeyZ"], shortcutHandler));
		expect(runner.runKeyboardCommand(store, commands.cmdUndo)).toBe(true);
		expect(atomHandler).toHaveBeenCalledTimes(1);
		expect(shortcutHandler).not.toHaveBeenCalled();
	});

	it("presses the shortcut for handlers registered by shortcut alone", () => {
		const store = createStore();
		const handler = vi.fn();
		const keys = store.get(commands.cmdDuplicatePaste.atom);
		cleanups.push(keyboard.registerKeyBindings(keys, handler));
		expect(runner.runKeyboardCommand(store, commands.cmdDuplicatePaste)).toBe(
			true,
		);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("presses in key-up trigger mode too", () => {
		const store = createStore();
		store.set(
			keyboard.keyBindingTriggerModeAtom,
			keyboard.KeyBindingTriggerMode.KeyUp,
		);
		const handler = vi.fn();
		cleanups.push(() =>
			store.set(
				keyboard.keyBindingTriggerModeAtom,
				keyboard.KeyBindingTriggerMode.KeyDown,
			),
		);
		cleanups.push(keyboard.registerKeyBindings(["Shift", "KeyE"], handler));
		runner.pressShortcut(["Shift", "KeyE"]);
		expect(handler).toHaveBeenCalledTimes(1);
	});

	it("reports false for an unbound command with no atom handler", async () => {
		const store = createStore();
		await store.set(commands.cmdLocateActiveLine.atom, []);
		expect(runner.runKeyboardCommand(store, commands.cmdLocateActiveLine)).toBe(
			false,
		);
	});
});
