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

let keyboard: typeof import("$/utils/keybindings");
let commands: typeof import("./commands");
let registry: typeof import("./registry");
let findConflicts: typeof import("./conflicts").findKeyBindingConflicts;
const storage = new Map<string, string>();
const cleanups: Array<() => void> = [];

// Node's EventTarget does not dispatch capture listeners before bubble listeners.
// Match the browser ordering so consuming a double tap exercises dispatcher cleanup.
class KeyboardWindow extends EventTarget {
	private listeners = new Map<
		string,
		Array<{
			callback: EventListenerOrEventListenerObject;
			capture: boolean;
		}>
	>();

	override addEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	) {
		if (!callback) return;
		const capture = typeof options === "boolean" ? options : !!options?.capture;
		const listeners = this.listeners.get(type) ?? [];
		listeners.push({ callback, capture });
		this.listeners.set(type, listeners);
	}

	override removeEventListener(
		type: string,
		callback: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions,
	) {
		const capture = typeof options === "boolean" ? options : !!options?.capture;
		this.listeners.set(
			type,
			(this.listeners.get(type) ?? []).filter(
				(listener) =>
					listener.callback !== callback || listener.capture !== capture,
			),
		);
	}

	override dispatchEvent(event: Event) {
		let stopped = false;
		const stop = event.stopImmediatePropagation.bind(event);
		event.stopImmediatePropagation = () => {
			stopped = true;
			stop();
		};
		const listeners = [...(this.listeners.get(event.type) ?? [])].sort(
			(a, b) => Number(b.capture) - Number(a.capture),
		);
		for (const { callback } of listeners) {
			if (stopped) break;
			if (typeof callback === "function") callback.call(this, event);
			else callback.handleEvent(event);
		}
		return !event.defaultPrevented;
	}
}

function key(
	type: "keydown" | "keyup",
	code: string,
	timeStamp = 0,
	modifiers: Partial<KeyboardEventInit> = {},
) {
	const event = new Event(type, { cancelable: true });
	Object.defineProperties(event, {
		code: { value: code },
		timeStamp: { value: timeStamp },
		repeat: { value: false },
		...Object.fromEntries(
			Object.entries(modifiers).map(([name, value]) => [name, { value }]),
		),
	});
	window.dispatchEvent(event);
	return event;
}

function pointer(
	type: "pointerdown" | "pointerup",
	button = 1,
	modifiers: Partial<MouseEventInit> = {},
) {
	const event = new Event(type, { cancelable: true });
	Object.defineProperties(
		event,
		Object.fromEntries(
			Object.entries({ button, ...modifiers }).map(([name, value]) => [
				name,
				{ value },
			]),
		),
	);
	window.dispatchEvent(event);
	return event;
}

beforeAll(async () => {
	vi.stubGlobal("window", new KeyboardWindow());
	vi.stubGlobal("document", { body: {}, activeElement: null });
	vi.stubGlobal("navigator", { userAgent: "Windows" });
	const localStorage = {
		getItem: (name: string) => storage.get(name) ?? null,
		setItem: (name: string, value: string) => storage.set(name, value),
		removeItem: (name: string) => storage.delete(name),
	};
	vi.stubGlobal("localStorage", localStorage);
	Object.assign(window, { localStorage });
	keyboard = await import("$/utils/keybindings");
	commands = await import("./commands");
	registry = await import("./registry");
	({ findKeyBindingConflicts: findConflicts } = await import("./conflicts"));
});

beforeEach(() => {
	storage.clear();
	Object.assign(document, { activeElement: null });
	window.dispatchEvent(new Event("blur"));
	createStore().set(
		keyboard.keyBindingTriggerModeAtom,
		keyboard.KeyBindingTriggerMode.KeyDown,
	);
});

afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	keyboard.stopRecordingShortcut();
});

describe("shortcut normalization and dispatch", () => {
	it("registers the clear-timing action and persists custom and unbound settings", async () => {
		expect(commands.cmdClearWordTiming.defaultKeys).toEqual(["MouseMiddle"]);
		expect(commands.cmdClearWordTiming.supportsMouse).toBe(true);
		expect(commands.cmdClearWordTiming.modes).toEqual(["sync"]);
		const binding = keyboard.atomWithKeybindingStorage(
			"clear-test",
			["MouseMiddle"],
			{ allowMouse: true },
		);
		const first = createStore();
		cleanups.push(first.sub(binding, () => {}));
		await first.set(binding, ["KeyX"]);
		const second = createStore();
		cleanups.push(second.sub(binding, () => {}));
		expect(second.get(binding)).toEqual(["KeyX"]);
		await second.set(binding, []);
		const third = createStore();
		cleanups.push(third.sub(binding, () => {}));
		expect(third.get(binding)).toEqual([]);
		await third.set(binding, keyboard.RESET_KEYBINDING);
		expect(third.get(binding)).toEqual(["MouseMiddle"]);
	});
	it("formats and matches scoped mouse shortcuts including modifiers", () => {
		expect(keyboard.formatKeyBindings(["MouseMiddle"])).toBe("Middle click");
		const mouse = {
			button: 1,
			ctrlKey: false,
			metaKey: false,
			altKey: false,
			shiftKey: false,
		};
		expect(keyboard.matchesMouseShortcut(["MouseMiddle"], mouse)).toBe(true);
		expect(keyboard.matchesMouseShortcut([], mouse)).toBe(false);
		expect(keyboard.matchesMouseShortcut(["KeyX"], mouse)).toBe(false);
		expect(keyboard.matchesMouseShortcut(["Shift", "MouseMiddle"], mouse)).toBe(
			false,
		);
		expect(
			keyboard.matchesMouseShortcut(["Shift", "MouseMiddle"], {
				...mouse,
				shiftKey: true,
			}),
		).toBe(true);
	});

	it("records a mouse shortcut only when the command supports it", async () => {
		const recording = keyboard.recordShortcut({ allowMouse: true });
		expect(pointer("pointerdown", 1, { shiftKey: true }).defaultPrevented).toBe(
			true,
		);
		pointer("pointerup", 1, { shiftKey: true });
		await expect(recording).resolves.toEqual(["Shift", "MouseMiddle"]);
		const keyboardOnly = keyboard.recordShortcut();
		expect(pointer("pointerdown").defaultPrevented).toBe(false);
		pointer("pointerup");
		key("keydown", "KeyX");
		key("keyup", "KeyX");
		await expect(keyboardOnly).resolves.toEqual(["KeyX"]);
	});

	it("keeps only modifiers with a recorded mouse button, since other keys cannot match", async () => {
		const recording = keyboard.recordShortcut({ allowMouse: true });
		key("keydown", "ControlLeft");
		key("keydown", "KeyX");
		pointer("pointerdown", 1, { ctrlKey: true });
		pointer("pointerup", 1, { ctrlKey: true });
		key("keyup", "KeyX");
		key("keyup", "ControlLeft");
		const recorded = await recording;
		expect(recorded).toEqual(["Control", "MouseMiddle"]);
		expect(
			keyboard.matchesMouseShortcut(recorded, {
				button: 1,
				ctrlKey: true,
				metaKey: false,
				altKey: false,
				shiftKey: false,
			}),
		).toBe(true);
	});

	it("cancels mouse recording and removes its listeners", async () => {
		const recording = keyboard.recordShortcut({ allowMouse: true });
		key("keydown", "Escape");
		key("keyup", "Escape");
		await expect(recording).rejects.toThrow("User canceled");
		expect(pointer("pointerdown").defaultPrevented).toBe(false);
		pointer("pointerup");
	});
	it.each([
		"ControlLeft",
		"ControlRight",
	])("matches saved %s modifiers", (modifier) => {
		const callback = vi.fn();
		cleanups.push(
			keyboard.registerKeyBindings([modifier, "ShiftLeft", "KeyS"], callback),
		);
		key("keydown", "ControlRight");
		key("keydown", "ShiftRight");
		key("keydown", "KeyS");
		expect(callback).toHaveBeenCalledOnce();
	});

	it.each([
		["KeyHome", "Home"],
		["KeyEnd", "End"],
	])("matches legacy %s as %s", (saved, code) => {
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings([saved], callback));
		key("keydown", code);
		expect(callback).toHaveBeenCalledOnce();
	});

	it("keeps directional keys distinct and normalizes modifier duplicates", () => {
		expect(
			keyboard.getShortcutKey(["ControlLeft", "Control", "ArrowRight"]),
		).toBe("Control + ArrowRight");
		expect(keyboard.getShortcutKey(["ArrowLeft"])).not.toBe(
			keyboard.getShortcutKey(["ArrowRight"]),
		);
	});

	it("formats directional keys consistently in text and array labels", () => {
		for (const [code, label] of Object.entries({
			ArrowLeft: "←",
			ArrowRight: "→",
			ArrowUp: "↑",
			ArrowDown: "↓",
			BracketLeft: "[",
			BracketRight: "]",
		})) {
			expect(keyboard.formatKeyBindings([code])).toBe(label);
			expect(keyboard.formatKeyBindingsAsArray([code])).toEqual([label]);
		}
		expect(
			keyboard.formatKeyBindings(["KeyS", "ShiftRight", "ControlLeft"]),
		).toBe("Ctrl+Shift+S");
	});

	it.each([
		[["Shift", "Digit2"], "Shift+2"],
		[["Control", "Numpad5"], "Ctrl+Num 5"],
		[["NumpadAdd"], "Num +"],
		[["Control", "Equal"], "Ctrl+="],
		[["Control", "Minus"], "Ctrl+-"],
		[["Backquote"], "`"],
		[["Comma"], ","],
		[["Period"], "."],
		[["Slash"], "/"],
		[["Semicolon"], ";"],
		[["Quote"], "'"],
		[["Space"], "Space"],
		[["Escape"], "Esc"],
		[["Alt", "ArrowUp"], "Alt+↑"],
		[["Meta", "KeyK"], "Win+K"],
	])("formats %j as %s", (keys, label) => {
		expect(keyboard.formatKeyBindings(keys)).toBe(label);
	});

	it("formats macOS shortcuts as joined symbols", () => {
		vi.stubGlobal("navigator", { userAgent: "Mac" });
		try {
			expect(keyboard.formatKeyBindings(["Meta", "Shift", "Digit2"])).toBe(
				"⌘⇧2",
			);
		} finally {
			vi.stubGlobal("navigator", { userAgent: "Windows" });
		}
	});

	it("leaves stored bindings and matching untouched", () => {
		expect(keyboard.getShortcutKey(["Shift", "Digit2"])).toBe("Shift + Digit2");
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(["KeyG"], callback));
		key("keydown", "KeyG");
		expect(callback).toHaveBeenCalledOnce();
	});

	it.each([
		"INPUT",
		"TEXTAREA",
		"SELECT",
		"contenteditable",
	])("ignores shortcuts while typing in %s", (tagName) => {
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(["Control", "Equal"], callback));
		Object.assign(document, {
			activeElement: {
				tagName,
				isContentEditable: tagName === "contenteditable",
			},
		});
		key("keydown", "ControlLeft");
		key("keydown", "Equal");
		key("keyup", "Equal");
		expect(callback).not.toHaveBeenCalled();
	});
});

describe("rolled sync keys", () => {
	it.each([
		"keydown",
		"keyup",
	] as const)("fires every press when keys overlap in %s mode", (mode) => {
		createStore().set(
			keyboard.keyBindingTriggerModeAtom,
			mode === "keyup"
				? keyboard.KeyBindingTriggerMode.KeyUp
				: keyboard.KeyBindingTriggerMode.KeyDown,
		);
		const next = vi.fn();
		const end = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(["KeyG"], next));
		cleanups.push(keyboard.registerKeyBindings(["KeyH"], end));
		key("keydown", "KeyH", 0);
		key("keydown", "KeyG", 40);
		key("keyup", "KeyH", 60);
		key("keydown", "KeyH", 80);
		key("keyup", "KeyG", 100);
		key("keyup", "KeyH", 120);
		expect(next).toHaveBeenCalledOnce();
		expect(end).toHaveBeenCalledTimes(2);
		expect(next).toHaveBeenCalledWith({
			downTime: 40,
			downTimeOffset: mode === "keyup" ? 60 : 0,
			triggerTime: mode === "keyup" ? 100 : 40,
		});
	});

	it("keeps held modifiers and exact chords", () => {
		const plain = vi.fn();
		const shifted = vi.fn();
		const chord = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(["KeyF"], plain));
		cleanups.push(keyboard.registerKeyBindings(["Shift", "KeyF"], shifted));
		cleanups.push(keyboard.registerKeyBindings(["KeyA", "KeyS"], chord));
		key("keydown", "KeyG");
		key("keydown", "ShiftLeft");
		key("keydown", "KeyF");
		expect(shifted).toHaveBeenCalledOnce();
		expect(plain).not.toHaveBeenCalled();
		window.dispatchEvent(new Event("blur"));
		key("keydown", "KeyA");
		key("keydown", "KeyS");
		expect(chord).toHaveBeenCalledOnce();
	});
});

describe("shortcut recording and storage", () => {
	it("unbinding a shortcut keeps its on-screen timing action available", async () => {
		const store = createStore();
		const binding = keyboard.atomWithKeybindingStorage("test", ["KeyA"]);
		await store.set(binding, []);
		const callback = vi.fn();
		cleanups.push(
			keyboard.registerKeyBindingAtom(binding, store.get(binding), callback),
		);
		key("keydown", "KeyA");
		expect(callback).not.toHaveBeenCalled();
		keyboard.forceInvokeKeyBindingAtom(store, binding);
		expect(callback).toHaveBeenCalledOnce();
	});

	it("on-screen invocation does not trigger another command sharing the shortcut", () => {
		const store = createStore();
		const first = keyboard.atomWithKeybindingStorage("first", ["KeyA"]);
		const second = keyboard.atomWithKeybindingStorage("second", ["KeyA"]);
		const firstAction = vi.fn();
		const secondAction = vi.fn();
		cleanups.push(
			keyboard.registerKeyBindingAtom(first, store.get(first), firstAction),
		);
		cleanups.push(
			keyboard.registerKeyBindingAtom(second, store.get(second), secondAction),
		);
		keyboard.forceInvokeKeyBindingAtom(store, first);
		expect(firstAction).toHaveBeenCalledOnce();
		expect(secondAction).not.toHaveBeenCalled();
	});
	it("consumes Escape before a dialog's bubble handler", async () => {
		const recording = keyboard.recordShortcut();
		const canceled = expect(recording).rejects.toThrow("User canceled");
		const dismissDialog = vi.fn();
		window.addEventListener("keydown", dismissDialog);
		cleanups.push(() => window.removeEventListener("keydown", dismissDialog));
		key("keydown", "Escape");
		key("keyup", "Escape");
		await canceled;
		expect(dismissDialog).not.toHaveBeenCalled();
	});
	it("records canonical modifiers and matches the recorded shortcut", async () => {
		const recording = keyboard.recordShortcut();
		key("keydown", "ControlLeft");
		key("keydown", "ShiftRight");
		key("keydown", "KeyS");
		key("keyup", "KeyS");
		key("keyup", "ShiftRight");
		key("keyup", "ControlLeft");
		const saved = await recording;
		expect(saved).toEqual(["Control", "Shift", "KeyS"]);
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(saved, callback));
		key("keydown", "ControlRight");
		key("keydown", "ShiftLeft");
		key("keydown", "KeyS");
		expect(callback).toHaveBeenCalledOnce();
	});

	it("Escape alone cancels and leaves an existing custom binding intact", async () => {
		const binding = keyboard.atomWithKeybindingStorage("test", ["KeyA"]);
		const store = createStore();
		await store.set(binding, ["KeyB"]);
		const recording = store.set(binding);
		key("keydown", "Escape");
		key("keyup", "Escape");
		await recording;
		expect(store.get(binding)).toEqual(["KeyB"]);
	});

	it("can record modified Escape for Deselect All", async () => {
		const recording = keyboard.recordShortcut();
		key("keydown", "ControlLeft");
		key("keydown", "Escape");
		key("keyup", "Escape");
		key("keyup", "ControlLeft");
		expect(await recording).toEqual(["Control", "Escape"]);
	});

	it("ignores the key release that opened the recorder", async () => {
		const recording = keyboard.recordShortcut();
		key("keyup", "Enter");
		key("keydown", "KeyB");
		key("keyup", "KeyB");
		expect(await recording).toEqual(["KeyB"]);
	});

	it("clears a binding, then resets its default", async () => {
		const binding = keyboard.atomWithKeybindingStorage("test", ["KeyA"]);
		const store = createStore();
		await store.set(binding, []);
		expect(store.get(binding)).toEqual([]);
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(store.get(binding), callback));
		key("keydown", "KeyA");
		expect(callback).not.toHaveBeenCalled();
		await store.set(binding, keyboard.RESET_KEYBINDING);
		expect(store.get(binding)).toEqual(["KeyA"]);
	});

	it("loads and dispatches legacy bindings from localStorage", () => {
		storage.set("keybindings:test", JSON.stringify(["ControlLeft", "KeyHome"]));
		const binding = keyboard.atomWithKeybindingStorage("test", ["KeyA"]);
		const store = createStore();
		cleanups.push(store.sub(binding, () => {}));
		const callback = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(store.get(binding), callback));
		key("keydown", "ControlRight");
		key("keydown", "Home");
		expect(callback).toHaveBeenCalledOnce();
	});
});

describe("double-press shortcuts", () => {
	it("does not leave the consumed key held in the key-up dispatcher", () => {
		createStore().set(
			keyboard.keyBindingTriggerModeAtom,
			keyboard.KeyBindingTriggerMode.KeyUp,
		);
		const double = vi.fn();
		const single = vi.fn();
		const next = vi.fn();
		cleanups.push(keyboard.registerKeyBindings(["KeyE"], single));
		cleanups.push(keyboard.registerDoubleKeyBindings(["KeyE"], double));
		cleanups.push(keyboard.registerKeyBindings(["KeyD"], next));
		key("keydown", "KeyE", 10);
		key("keyup", "KeyE", 20);
		key("keydown", "KeyE", 100);
		key("keyup", "KeyE", 110);
		key("keydown", "KeyD", 150);
		key("keyup", "KeyD", 160);
		expect(single).toHaveBeenCalledOnce();
		expect(double).toHaveBeenCalledOnce();
		expect(next).toHaveBeenCalledOnce();
	});
	it.each([
		"keydown",
		"keyup",
	] as const)("triggers only on the preferred %s event", (mode) => {
		createStore().set(
			keyboard.keyBindingTriggerModeAtom,
			mode === "keyup"
				? keyboard.KeyBindingTriggerMode.KeyUp
				: keyboard.KeyBindingTriggerMode.KeyDown,
		);
		const callback = vi.fn();
		cleanups.push(keyboard.registerDoubleKeyBindings(["KeyE"], callback));
		key("keydown", "KeyE", 10);
		key("keyup", "KeyE", 30);
		expect(callback).not.toHaveBeenCalled();
		key("keydown", "KeyE", 100);
		expect(callback).toHaveBeenCalledTimes(mode === "keydown" ? 1 : 0);
		key("keyup", "KeyE", 120);
		expect(callback).toHaveBeenCalledOnce();
		expect(callback).toHaveBeenCalledWith({
			downTime: 100,
			downTimeOffset: mode === "keyup" ? 20 : 0,
			triggerTime: mode === "keyup" ? 120 : 100,
		});
	});

	it("supports remapped modifiers released between taps", () => {
		const callback = vi.fn();
		cleanups.push(
			keyboard.registerDoubleKeyBindings(["ControlLeft", "KeyE"], callback),
		);
		for (const time of [10, 100]) {
			key("keydown", "ControlRight", time);
			key("keydown", "KeyE", time + 5, { ctrlKey: true });
			key("keyup", "KeyE", time + 10, { ctrlKey: true });
			key("keyup", "ControlRight", time + 15);
		}
		expect(callback).toHaveBeenCalledOnce();
	});

	it("does not count slow taps or taps interrupted by typing", () => {
		const callback = vi.fn();
		cleanups.push(keyboard.registerDoubleKeyBindings(["KeyE"], callback));
		key("keydown", "KeyE", 0);
		key("keyup", "KeyE", 10);
		key("keydown", "KeyE", 500);
		Object.assign(document, { activeElement: { tagName: "INPUT" } });
		key("keydown", "KeyE", 510);
		Object.assign(document, { activeElement: null });
		key("keydown", "KeyE", 520);
		expect(callback).not.toHaveBeenCalled();
	});
});

describe("command defaults and conflict warnings", () => {
	it("has no default collisions in any editor mode", () => {
		expect(
			findConflicts(
				registry
					.getAllCommands()
					.map((command) => ({ command, keys: command.defaultKeys })),
			),
		).toEqual(new Map());
	});

	it("warns for normalized remaps in overlapping modes", () => {
		const result = findConflicts([
			{ command: commands.cmdRedo, keys: ["ControlLeft", "KeyHome"] },
			{ command: commands.cmdMoveFirstWordAndPlay, keys: ["Home", "Control"] },
		]);
		expect(result.get("redo")).toEqual([commands.cmdMoveFirstWordAndPlay]);
		expect(result.get("moveFirstWordAndPlay")).toEqual([commands.cmdRedo]);
	});

	it("does not warn for exclusive modes or unbound commands", () => {
		expect(
			findConflicts([
				{ command: commands.cmdUrbanDictionary, keys: ["Shift", "KeyF"] },
				{ command: commands.cmdUrbanDictionarySync, keys: ["Shift", "KeyF"] },
				{ command: commands.cmdRedo, keys: [] },
				{ command: commands.cmdUndo, keys: [] },
			]),
		).toEqual(new Map());
	});
});
