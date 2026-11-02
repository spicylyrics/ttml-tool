import { createStore, Provider } from "jotai";
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { KeyBindingCallback } from "$/utils/keybindings";

const { handlers, doublePressShortcuts, menuActions } = vi.hoisted(() => {
	vi.stubGlobal("window", new EventTarget());
	vi.stubGlobal("document", { activeElement: null });
	vi.stubGlobal("navigator", { userAgent: "Windows" });
	return {
		handlers: new Map<string, KeyBindingCallback>(),
		/** Shortcuts registered as "Press twice to run". */
		doublePressShortcuts: new Set<string>(),
		menuActions: {
			onNewFile: vi.fn(),
			onOpenFile: vi.fn(),
			onSaveFile: vi.fn(),
			onUndo: vi.fn(),
			onRedo: vi.fn(),
			onUnselectAll: vi.fn(),
			onSelectAll: vi.fn(),
			onSelectInverted: vi.fn(),
			onSelectWordsOfMatchedSelection: vi.fn(),
			onDeleteSelection: vi.fn(),
			onAutoSegment: vi.fn(),
			onQuickAutoSegment: vi.fn(),
		},
	};
});

vi.mock("$/utils/keybindings", async (importOriginal) => {
	const original = await importOriginal<typeof import("$/utils/keybindings")>();
	const { useAtomValue } = await import("jotai");
	return {
		...original,
		useKeyBinding: (keys: string[], callback: KeyBindingCallback) => {
			handlers.set(original.getShortcutKey(keys), callback);
		},
		useKeyBindingAtom: (
			binding: ReturnType<typeof original.atomWithKeybindingStorage>,
			callback: KeyBindingCallback,
		) => {
			const keys = useAtomValue(binding);
			const shortcut = original.getShortcutKey(keys);
			handlers.set(shortcut, callback);
			if (original.useDoublePress(binding)) doublePressShortcuts.add(shortcut);
			return keys;
		},
	};
});

vi.mock("$/components/TopMenu/useTopMenuActions", () => ({
	useTopMenuActions: () => menuActions,
}));
vi.mock("$/components/TopMenu/HeaderFileInfo", () => ({
	HeaderFileInfo: () => null,
}));
vi.mock("$/components/TopMenu/modals/EditMenu", () => ({
	EditMenu: () => null,
}));
vi.mock("$/components/TopMenu/modals/FileMenu", () => ({
	FileMenu: () => null,
}));
vi.mock("$/components/TopMenu/modals/HelpMenu", () => ({
	HelpMenu: () => null,
}));
vi.mock("$/components/TopMenu/modals/HomeMenu", () => ({
	HomeMenu: () => null,
}));
vi.mock("$/components/TopMenu/modals/ToolMenu", () => ({
	ToolMenu: () => null,
}));
vi.mock("$/modules/menu-actions/MenuActionShortcuts", () => ({
	MenuActionShortcuts: () => null,
}));

vi.mock("$/modules/audio/audio-engine", () => ({
	audioEngine: {
		resumeOrSeekMusic: vi.fn(async () => {}),
		seekMusic: vi.fn(),
		auditionRange: vi.fn(),
	},
}));

vi.mock("$/modules/segmentation/utils/segment-processing", async () => {
	const { atom } = await import("jotai");
	return {
		processedLyricLinesAtom: atom([
			{ segments: [{ type: "word", id: "zero", startTime: 0, endTime: 500 }] },
		]),
	};
});

import { TopMenu } from "$/components/TopMenu";
import { audioEngine } from "$/modules/audio/audio-engine";
import { SyncKeyBinding } from "$/modules/lyric-editor/components/sync-keybinding";
import { InterfaceScaleManager } from "$/modules/settings/components/InterfaceScaleManager";
import { interfaceScaleAtom } from "$/modules/settings/states";
import { useTimelineEditing } from "$/modules/spectrogram/hooks/useTimelineEditing";
import { selectedWordIdAtom } from "$/modules/spectrogram/states/dnd";
import {
	editingTimeFieldAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	cmdCancelTimelineEditing,
	cmdInterfaceScaleUp,
	cmdRedo,
	cmdRedoAlternate,
} from "./commands";
import { AuditionKeyBinding } from "./components/AuditionKeyBinding";
import { doublePressAtom } from "./states";
// Installs the second-key and double-press resolvers, as App does.
import "./binding-list";

function invoke(shortcut: string) {
	const handler = handlers.get(shortcut);
	expect(handler).toBeDefined();
	handler?.({ downTime: 0, downTimeOffset: 0, triggerTime: 0 });
}

function mount(
	component: typeof SyncKeyBinding,
	store: ReturnType<typeof createStore>,
) {
	renderToString(createElement(Provider, { store }, createElement(component)));
}

beforeEach(() => {
	handlers.clear();
	doublePressShortcuts.clear();
	vi.clearAllMocks();
	vi.unstubAllEnvs();
});

describe("menu shortcut wiring", () => {
	it("Select All and Deselect All have separate listeners", () => {
		mount(TopMenu, createStore());
		invoke("Control + KeyA");
		expect(menuActions.onSelectAll).toHaveBeenCalledOnce();
		expect(menuActions.onUnselectAll).not.toHaveBeenCalled();
		invoke("Control + Escape");
		expect(menuActions.onUnselectAll).toHaveBeenCalledOnce();
	});

	it("both redo shortcuts follow their saved remaps", async () => {
		const store = createStore();
		await store.set(cmdRedo.atom, ["Control", "KeyB"]);
		await store.set(cmdRedoAlternate.atom, ["Control", "KeyR"]);
		mount(TopMenu, store);
		expect(handlers.has("Control + Shift + KeyZ")).toBe(false);
		expect(handlers.has("Control + KeyY")).toBe(false);
		invoke("Control + KeyB");
		invoke("Control + KeyR");
		expect(menuActions.onRedo).toHaveBeenCalledTimes(2);
	});

	it("quick segmentation and the dialog have distinct shortcuts", () => {
		mount(TopMenu, createStore());
		invoke("KeyE");
		expect(menuActions.onQuickAutoSegment).toHaveBeenCalledOnce();
		invoke("Shift + KeyE");
		expect(menuActions.onAutoSegment).toHaveBeenCalledOnce();
	});

	it("quick segmentation waits for a double press by default, and only it", () => {
		mount(TopMenu, createStore());
		expect([...doublePressShortcuts]).toEqual(["KeyE"]);
	});

	it("quick segmentation runs on one press once Press twice to run is off", () => {
		const store = createStore();
		store.set(doublePressAtom("autoSegment"), false);
		mount(TopMenu, store);
		expect(doublePressShortcuts.size).toBe(0);
	});
});

describe("registered scale and timeline commands", () => {
	it("leaves browser zoom shortcuts unregistered", () => {
		mount(InterfaceScaleManager, createStore());
		expect(handlers.has("Control + Equal")).toBe(false);
		expect(handlers.has("Control + Minus")).toBe(false);
		expect(handlers.has("Control + Digit0")).toBe(false);
	});

	it("changes desktop scale through a remappable command", async () => {
		vi.stubEnv("TAURI_ENV_PLATFORM", "windows");
		const store = createStore();
		await store.set(cmdInterfaceScaleUp.atom, ["Control", "KeyU"]);
		mount(InterfaceScaleManager, store);
		expect(handlers.has("Control + Equal")).toBe(false);
		invoke("Control + KeyU");
		expect(store.get(interfaceScaleAtom)).toBe(1.05);
		invoke("Control + Minus");
		expect(store.get(interfaceScaleAtom)).toBe(1);
		store.set(interfaceScaleAtom, 1.3);
		invoke("Control + Digit0");
		expect(store.get(interfaceScaleAtom)).toBe(1);
	});

	it("honors the remapped timeline cancellation command", async () => {
		class Element {
			blur = vi.fn();
		}
		vi.stubGlobal("HTMLElement", Element);
		const activeElement = new Element();
		Object.assign(document, { activeElement });
		const store = createStore();
		store.set(editingTimeFieldAtom, { isWord: false, field: "endTime" });
		await store.set(cmdCancelTimelineEditing.atom, ["Control", "KeyQ"]);
		mount(() => {
			useTimelineEditing(0, 1);
			return null;
		}, store);
		expect(handlers.has("Escape")).toBe(false);
		invoke("Control + KeyQ");
		expect(activeElement.blur).toHaveBeenCalledOnce();
		Object.assign(document, { activeElement: null });
	});
});

describe("move to word and play handlers", () => {
	const fixture = () => {
		const store = createStore();
		const first = {
			...newLyricWord(),
			id: "first",
			word: "one",
			startTime: 0,
			endTime: 500,
		};
		const middle = {
			...newLyricWord(),
			id: "middle",
			word: "two",
			startTime: 500,
			endTime: 1000,
		};
		const last = {
			...newLyricWord(),
			id: "last",
			word: "three",
			startTime: 1000,
			endTime: 1500,
		};
		const line = {
			...newLyricLine(),
			id: "line",
			words: [first, middle, last],
		};
		store.set(lyricLinesAtom, { metadata: [], lyricLines: [line] });
		store.set(selectedLinesAtom, new Set([line.id]));
		store.set(selectedWordsAtom, new Set([middle.id]));
		mount(SyncKeyBinding, store);
		return store;
	};

	it.each([
		["KeyR", "first", 0],
		["KeyY", "last", 1],
		["Home", "first", 0],
		["End", "last", 1],
	] as const)("%s selects the word and starts playback", (shortcut, id, seconds) => {
		const store = fixture();
		invoke(shortcut);
		expect(store.get(selectedWordsAtom)).toEqual(new Set([id]));
		expect(audioEngine.resumeOrSeekMusic).toHaveBeenCalledWith(seconds);
		expect(audioEngine.seekMusic).not.toHaveBeenCalled();
	});

	it("previous-word-and-play resumes at the previous line's last word", () => {
		const store = fixture();
		const next = {
			...newLyricWord(),
			id: "next",
			word: "four",
			startTime: 2000,
		};
		const nextLine = { ...newLyricLine(), id: "nextLine", words: [next] };
		store.set(lyricLinesAtom, (lyrics) => ({
			...lyrics,
			lyricLines: [...lyrics.lyricLines, nextLine],
		}));
		store.set(selectedLinesAtom, new Set([nextLine.id]));
		store.set(selectedWordsAtom, new Set([next.id]));
		invoke("KeyR");
		expect(store.get(selectedWordsAtom)).toEqual(new Set(["last"]));
		expect(store.get(selectedLinesAtom)).toEqual(new Set(["line"]));
		expect(audioEngine.resumeOrSeekMusic).toHaveBeenCalledWith(1);
	});

	it("plain navigation does not start playback", () => {
		fixture();
		invoke("KeyD");
		expect(audioEngine.resumeOrSeekMusic).not.toHaveBeenCalled();
	});
});

describe("audition handlers", () => {
	it.each([
		["KeyQ", -0.5, 0],
		["KeyB", 0, 0.5],
		["KeyN", 0.5, 1],
	] as const)("%s auditions a word starting at zero", (shortcut, start, end) => {
		const store = createStore();
		store.set(selectedWordIdAtom, "zero");
		mount(AuditionKeyBinding, store);
		invoke(shortcut);
		expect(audioEngine.auditionRange).toHaveBeenCalledWith(start, end);
	});

	it("does nothing without a selected word", () => {
		mount(AuditionKeyBinding, createStore());
		invoke("KeyB");
		expect(audioEngine.auditionRange).not.toHaveBeenCalled();
	});
});
