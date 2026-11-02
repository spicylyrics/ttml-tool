import { createStore } from "jotai";
import {
	afterEach,
	beforeAll,
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from "vitest";

vi.mock("virtual:buildmeta", () => ({
	BUILD_TIME: "2026-01-01T00:00:00.000Z",
	GIT_COMMIT: "test",
}));
vi.mock("$/utils/fileSystem", () => ({ saveFile: vi.fn() }));
vi.mock("$/modules/project/autosave/autosave", () => ({
	exportAllProjectsData: vi.fn(async () => ({ projects: [], versions: [] })),
	restoreProjectsData: vi.fn(),
}));
vi.mock("$/modules/settings/modals/customBackground", () => ({
	readCustomBackgroundBlob: vi.fn(async () => null),
	writeCustomBackgroundBlob: vi.fn(),
}));

let keyboard: typeof import("$/utils/keybindings");
let list: typeof import("./binding-list");
let commands: typeof import("./commands");
let conflicts: typeof import("./conflicts");
let backupExport: typeof import("$/modules/settings/backup/export");
let backupImport: typeof import("$/modules/settings/backup/import");
const storage = new Map<string, string>();
const cleanups: Array<() => void> = [];

beforeAll(async () => {
	vi.stubGlobal("window", new EventTarget());
	vi.stubGlobal("document", { body: {}, activeElement: null });
	vi.stubGlobal("navigator", { userAgent: "Windows" });
	const localStorage = {
		get length() {
			return storage.size;
		},
		key: (index: number) => [...storage.keys()][index] ?? null,
		getItem: (name: string) => storage.get(name) ?? null,
		setItem: (name: string, value: string) => storage.set(name, String(value)),
		removeItem: (name: string) => storage.delete(name),
		clear: () => storage.clear(),
	};
	vi.stubGlobal("localStorage", localStorage);
	Object.assign(window, { localStorage });
	keyboard = await import("$/utils/keybindings");
	list = await import("./binding-list");
	commands = await import("./commands");
	conflicts = await import("./conflicts");
	backupExport = await import("$/modules/settings/backup/export");
	backupImport = await import("$/modules/settings/backup/import");
});

beforeEach(() => storage.clear());
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
});

function mounted() {
	const store = createStore();
	cleanups.push(store.sub(list.allKeyBindingListsAtom, () => {}));
	return store;
}

describe("reading stored bindings as lists", () => {
	it.each([
		[["KeyF"], [["KeyF"]]],
		[[], []],
		[
			[["KeyF"], ["KeyZ"], [], ["KeyF"]],
			[["KeyF"], ["KeyZ"]],
		],
		[[["ControlLeft", "KeyS"]], [["Control", "KeyS"]]],
		["KeyF", []],
		[null, []],
		[[["KeyF"], "KeyZ", 3], [["KeyF"]]],
	])("reads %j as %j", (stored, expected) => {
		expect(list.toKeyBindingList(stored)).toEqual(expected);
	});
});

describe("extra keys", () => {
	it("reads no stored extras as one shared empty list", () => {
		const store = mounted();
		const extras = store.get(list.extraKeyBindingsAtom(commands.cmdSyncStart));
		expect(extras).toEqual([]);
		// Same reference every time, so hooks never re-register for it.
		expect(store.get(list.extraKeyBindingsAtom(commands.cmdSyncNext))).toBe(
			extras,
		);
		expect(store.get(list.keyBindingListAtom(commands.cmdSyncStart))).toEqual([
			["KeyF"],
		]);
	});

	it("adds stored extras after the primary and drops repeats of it", () => {
		storage.set("keybindings:syncStart", JSON.stringify(["KeyJ"]));
		storage.set(
			list.extraKeyBindingsStorageKey("syncStart"),
			JSON.stringify([["KeyZ"], ["KeyJ"], ["KeyZ"]]),
		);
		const store = mounted();
		expect(store.get(list.keyBindingListAtom(commands.cmdSyncStart))).toEqual([
			["KeyJ"],
			["KeyZ"],
		]);
	});

	it("writes the primary to its old key and the rest beside it", async () => {
		const store = mounted();
		const syncNext = list.keyBindingListAtom(commands.cmdSyncNext);
		await store.set(syncNext, [["KeyG"], ["KeyX"], ["KeyC"]]);
		expect(storage.get("keybindings:syncNext")).toBe(JSON.stringify(["KeyG"]));
		expect(storage.get("keybindings:syncNextExtra")).toBe(
			JSON.stringify([["KeyX"], ["KeyC"]]),
		);
		expect(store.get(commands.cmdSyncNext.atom)).toEqual(["KeyG"]);
		await store.set(syncNext, keyboard.RESET_KEYBINDING);
		expect(store.get(syncNext)).toEqual([["KeyG"]]);
		// No stray empty key left behind to show up in backups.
		expect(storage.has("keybindings:syncNextExtra")).toBe(false);
		await store.set(syncNext, [["KeyG"], ["KeyX"]]);
		await store.set(syncNext, [["KeyG"]]);
		expect(storage.has("keybindings:syncNextExtra")).toBe(false);
	});
});

describe("registering extra keys", () => {
	function press(code: string) {
		for (const type of ["keydown", "keyup"]) {
			const event = new Event(type, { cancelable: true });
			Object.defineProperties(event, {
				code: { value: code },
				timeStamp: { value: 0 },
				repeat: { value: false },
			});
			window.dispatchEvent(event);
		}
	}

	it("registers each extra once and never the primary again", () => {
		const callback = vi.fn();
		cleanups.push(
			keyboard.registerExtraKeyBindings(
				["KeyF"],
				[["KeyF"], ["KeyZ"], ["KeyZ"], []],
				callback,
			),
		);
		press("KeyF");
		expect(callback).not.toHaveBeenCalled();
		press("KeyZ");
		expect(callback).toHaveBeenCalledOnce();
	});

	it("unregisters every extra", () => {
		const callback = vi.fn();
		keyboard.registerExtraKeyBindings([], [["KeyZ"], ["KeyX"]], callback)();
		press("KeyZ");
		press("KeyX");
		expect(callback).not.toHaveBeenCalled();
	});
});

describe("conflicts across lists", () => {
	it("finds an extra key that another action already uses", () => {
		const found = conflicts.findKeyBindingListConflicts([
			{ command: commands.cmdSyncStart, lists: [["KeyF"], ["KeyG"]] },
			{ command: commands.cmdSyncNext, lists: [["KeyG"]] },
			{ command: commands.cmdSyncEnd, lists: [["KeyH"], ["KeyH"]] },
		]);
		expect(found.get("syncStart")).toEqual([commands.cmdSyncNext]);
		expect(found.get("syncNext")).toEqual([commands.cmdSyncStart]);
		// Repeating your own key is not a conflict.
		expect(found.has("syncEnd")).toBe(false);
	});

	it("matches the single-binding result for single lists", () => {
		const bindings = [
			{ command: commands.cmdSyncStart, keys: ["KeyF"] },
			{ command: commands.cmdUrbanDictionarySync, keys: ["KeyF"] },
			{ command: commands.cmdUrbanDictionary, keys: ["KeyF"] },
		];
		const single = conflicts.findKeyBindingConflicts(bindings);
		expect(single.get("syncStart")).toEqual([commands.cmdUrbanDictionarySync]);
		expect(single.has("urbanDictionary")).toBe(false);
	});

	it("names the other owners of a shortcut", () => {
		expect(
			conflicts.findShortcutOwners(
				[
					{ command: commands.cmdSyncStart, lists: [["KeyF"]] },
					{ command: commands.cmdSyncNext, lists: [["KeyG"], ["KeyZ"]] },
					{ command: commands.cmdUrbanDictionary, lists: [["KeyZ"]] },
				],
				["KeyZ"],
				commands.cmdSyncStart,
			),
		).toEqual([commands.cmdSyncNext]);
	});
});

describe("settings backups", () => {
	const KEYBINDINGS = new Set(["keybindings"] as const);

	it("restores an old single-binding backup as a one-entry list", async () => {
		const old = backupImport.parseBackupFile(
			JSON.stringify({
				app: "amll-ttml-tool",
				formatVersion: 1,
				exportedAt: "2026-01-01T00:00:00.000Z",
				build: { commit: "old", time: "2026-01-01T00:00:00.000Z" },
				categories: {
					keybindings: {
						localStorage: { "keybindings:syncStart": JSON.stringify(["KeyJ"]) },
					},
				},
			}),
		);
		await backupImport.applyBackup(old, KEYBINDINGS);
		const store = mounted();
		expect(store.get(list.keyBindingListAtom(commands.cmdSyncStart))).toEqual([
			["KeyJ"],
		]);
	});

	it("carries extra keys through export and restore", async () => {
		storage.set("keybindings:syncNext", JSON.stringify(["KeyG"]));
		storage.set("keybindings:syncNextExtra", JSON.stringify([["KeyX"]]));
		const backup = JSON.parse(
			JSON.stringify(await backupExport.buildBackup(KEYBINDINGS)),
		);
		expect(backup.formatVersion).toBe(1);
		storage.clear();
		await backupImport.applyBackup(backup, KEYBINDINGS);
		const store = mounted();
		expect(store.get(list.keyBindingListAtom(commands.cmdSyncNext))).toEqual([
			["KeyG"],
			["KeyX"],
		]);
	});
});
