import { beforeAll, describe, expect, it, vi } from "vitest";

let index: typeof import("./key-index");
let layouts: typeof import("./layouts");
let labels: typeof import("./labels");
let commands: typeof import("../commands");

beforeAll(async () => {
	vi.stubGlobal("window", new EventTarget());
	vi.stubGlobal("document", { body: {}, activeElement: null });
	vi.stubGlobal("navigator", { userAgent: "Windows" });
	vi.stubGlobal("localStorage", {
		getItem: () => null,
		setItem: () => {},
		removeItem: () => {},
	});
	index = await import("./key-index");
	layouts = await import("./layouts");
	labels = await import("./labels");
	commands = await import("../commands");
});

describe("categories", () => {
	it("sorts registry commands into the four view colors", () => {
		expect(index.viewCategoryOf(commands.cmdSyncStart)).toBe("sync");
		expect(index.viewCategoryOf(commands.cmdToggleWordHighlight)).toBe("sync");
		expect(index.viewCategoryOf(commands.cmdMoveNextWord)).toBe("navigation");
		expect(index.viewCategoryOf(commands.cmdSwitchSyncMode)).toBe("navigation");
		expect(index.viewCategoryOf(commands.cmdPlayPause)).toBe("playback");
		expect(index.viewCategoryOf(commands.cmdAuditionSelection)).toBe(
			"playback",
		);
		expect(index.viewCategoryOf(commands.cmdSaveFile)).toBe("edit");
		expect(index.viewCategoryOf(commands.cmdUndo)).toBe("edit");
	});
});

describe("key index", () => {
	const bindings = () => [
		{ command: commands.cmdSyncStart, lists: [["KeyF"], ["KeyZ"]] },
		{ command: commands.cmdUrbanDictionarySync, lists: [["Shift", "KeyF"]] },
		{ command: commands.cmdSaveFile, lists: [["ControlLeft", "KeyS"]] },
		{ command: commands.cmdMoveNextLine, lists: [["KeyA", "KeyS"]] },
		{ command: commands.cmdUndo, lists: [[]] },
	];

	it("files every binding under its keys with its slot and modifiers", () => {
		const keys = index.buildKeyIndex(bindings());
		expect(keys.get("KeyZ")?.map((ref) => [ref.command.id, ref.slot])).toEqual([
			["syncStart", 1],
		]);
		expect(keys.get("KeyS")?.map((ref) => ref.command.id)).toEqual([
			"saveFile",
			"moveNextLine",
		]);
		expect(keys.get("KeyA")?.[0].chordWith).toEqual(["KeyS"]);
		expect(keys.has("Control")).toBe(false);
	});

	it("shows only the bindings held with exactly the chosen modifiers", () => {
		const keys = index.buildKeyIndex(bindings());
		const onF = keys.get("KeyF");
		expect(index.refsInLayer(onF, []).map((ref) => ref.command.id)).toEqual([
			"syncStart",
		]);
		expect(
			index.refsInLayer(onF, ["Shift"]).map((ref) => ref.command.id),
		).toEqual(["urbanDictionarySync"]);
		expect(index.refsInLayer(keys.get("KeyS"), ["Control"])).toHaveLength(1);
		expect(index.refsInLayer(onF, ["Control"])).toEqual([]);
	});

	it("puts a modifier-only shortcut on its last key", () => {
		expect(index.splitBinding(["ShiftLeft"])).toEqual({
			modifiers: [],
			keys: ["Shift"],
		});
		expect(index.splitBinding(["Control", "Shift", "KeyZ"])).toEqual({
			modifiers: ["Control", "Shift"],
			keys: ["KeyZ"],
		});
	});
});

describe("search", () => {
	const names: Record<string, string> = {
		syncStart: "Timing - Start",
		syncEnd: "Timing - End",
		playPause: "Play / pause",
	};
	const all = () => [
		commands.cmdSyncStart,
		commands.cmdSyncEnd,
		commands.cmdPlayPause,
	];

	it("matches every word, ignoring case and accents", () => {
		const nameOf = (command: { id: string }) => names[command.id];
		expect(index.matchCommands(all(), "timing", nameOf)).toEqual(
			new Set(["syncStart", "syncEnd"]),
		);
		expect(index.matchCommands(all(), "TÍMING start", nameOf)).toEqual(
			new Set(["syncStart"]),
		);
		expect(index.matchCommands(all(), "  ", nameOf)).toEqual(new Set());
	});

	describe("by key", () => {
		const keyNames: Record<string, string> = {
			saveFile: "Save file",
			playPause: "Play / pause",
			syncStart: "Timing - Start",
			undo: "Undo",
		};
		const nameOf = (command: { id: string }) => keyNames[command.id];
		const bindings = () => [
			{ command: commands.cmdSaveFile, lists: [["Control", "KeyS"]] },
			{ command: commands.cmdPlayPause, lists: [["Space"]] },
			{ command: commands.cmdSyncStart, lists: [["KeyF"], ["KeyJ"]] },
			{ command: commands.cmdUndo, lists: [[]] },
		];
		const search = (query: string) =>
			index.matchShortcutSearch(bindings(), query, nameOf);

		it("finds what a shortcut is bound to, written any way", () => {
			for (const query of ["Ctrl+S", "ctrl + s", "control+s", "ctrl s"])
				expect(search(query), query).toEqual(new Set(["saveFile"]));
			expect(search("space")).toEqual(new Set(["playPause"]));
		});

		it("treats a single letter as a key, including extra keys", () => {
			// "f" would match "Save file" by name; as a key it's Timing - Start.
			expect(search("f")).toEqual(new Set(["syncStart"]));
			expect(search("J")).toEqual(new Set(["syncStart"]));
		});

		it("still finds actions by name, bound or not", () => {
			expect(search("save")).toEqual(new Set(["saveFile"]));
			expect(search("undo")).toEqual(new Set(["undo"]));
			expect(search("ctrl+q")).toEqual(new Set());
		});
	});
});

describe("editing a list", () => {
	it("fills an unbound primary before adding an extra", () => {
		expect(index.withBinding([[]], "add", ["KeyZ"])).toEqual([["KeyZ"]]);
		expect(index.withBinding([["KeyF"]], "add", ["KeyZ"])).toEqual([
			["KeyF"],
			["KeyZ"],
		]);
		expect(index.withBinding([["KeyF"], ["KeyZ"]], 1, ["KeyX"])).toEqual([
			["KeyF"],
			["KeyX"],
		]);
	});

	it("promotes the next key when the primary is removed", () => {
		expect(index.withoutBinding([["KeyF"], ["KeyZ"]], 0)).toEqual([["KeyZ"]]);
		expect(index.withoutBinding([["KeyF"]], 0)).toEqual([[]]);
	});
});

describe("layouts and labels", () => {
	it("has rows of 15 units in both shapes", () => {
		for (const geometry of ["ansi", "iso"] as const) {
			for (const row of layouts.mainRows(geometry)) {
				const width = row.reduce(
					(sum, item) =>
						sum + (layouts.isGap(item) ? item.gap : (item.width ?? 1)),
					0,
				);
				expect(width).toBe(15);
			}
		}
		for (const row of layouts.NAVIGATION_ROWS) {
			const width = row.reduce(
				(sum, item) =>
					sum + (layouts.isGap(item) ? item.gap : (item.width ?? 1)),
				0,
			);
			expect(width).toBe(3);
		}
	});

	it("guesses the layout family from the reported map", () => {
		expect(layouts.guessLayout(new Map([["KeyQ", "a"]]))).toBe("azerty");
		expect(layouts.guessLayout(new Map([["KeyY", "z"]]))).toBe("qwertz");
		expect(layouts.guessLayout(new Map([["KeyQ", "q"]]))).toBe("qwerty");
	});

	it("labels caps from the reported layout, then the picker, then the shared formatter", () => {
		const reported = {
			layout: "azerty" as const,
			canDetect: true,
			labels: new Map([["KeyQ", "a"]]),
		};
		expect(labels.capLabel("KeyQ", reported)).toBe("A");
		expect(labels.capLabel("KeyW", reported)).toBe("Z");
		const picked = { layout: "qwerty" as const, canDetect: false };
		expect(labels.capLabel("Digit2", picked)).toBe("2");
		expect(labels.capLabel("ArrowLeft", picked)).toBe("←");
		expect(labels.capLabel("Control", picked)).toBe("Ctrl");
		expect(labels.capLabel("CapsLock", picked)).toBe("Caps");
		expect(labels.formatViewCombo(["ShiftLeft", "Digit2"], picked)).toBe(
			"Shift+2",
		);
		expect(
			labels.formatViewCombo(["Control", "KeyQ"], {
				layout: "azerty",
				canDetect: false,
			}),
		).toBe("Ctrl+Q");
		expect(
			labels.capShortcutKey("KeyY", { layout: "qwertz", canDetect: false }),
		).toBe("KeyZ");
		expect(labels.capShortcutKey("KeyQ", reported)).toBe("KeyA");
		expect(
			labels.capShortcutKey("KeyZ", {
				layout: "qwerty",
				canDetect: true,
				labels: new Map([["KeyZ", "я"]]),
			}),
		).toBe("KeyZ");
		const azerty = { layout: "azerty" as const, canDetect: false };
		expect(labels.capShortcutKey("Quote", azerty)).toBe("Quote");
		expect(labels.capShortcutKey("Digit1", azerty)).toBe("Digit1");
		expect(labels.formatViewCombo(["Quote"], azerty)).toBe("ù");
	});

	it("shortens long names on the cap face only", () => {
		const picked = { layout: "qwerty" as const, canDetect: false };
		expect(labels.capFaceLabel("PageUp", picked)).toBe("PgUp");
		expect(labels.capLabel("PageUp", picked)).toBe("Page Up");
		expect(labels.capFaceLabel("KeyQ", picked)).toBe("Q");
		expect(labels.formatViewCombo(["Control", "Delete"], picked)).toBe(
			"Ctrl+Delete",
		);
	});
});
