// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { extraKeyBindingsStorageKey } from "$/modules/keyboard/binding-list";
import { smartLastWordAtom } from "$/modules/settings/states";
import { backgroundSyncLaneAtom } from "$/modules/settings/states/background-sync";
import {
	syncCommitOffsetAtom,
	syncLevelModeAtom,
	syncTimeOffsetAtom,
} from "$/modules/settings/states/sync";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	KeyBindingTriggerMode,
	keyBindingTriggerModeAtom,
} from "$/utils/keybindings";
import { SyncKeyBinding } from "./sync-keybinding";

// Node's own localStorage stub shadows jsdom's; use a plain in-memory one.
vi.hoisted(() => {
	const data = new Map<string, string>();
	vi.stubGlobal("localStorage", {
		getItem: (name: string) => data.get(name) ?? null,
		setItem: (name: string, value: string) => data.set(name, String(value)),
		removeItem: (name: string) => data.delete(name),
		clear: () => data.clear(),
	});
});
const audio = vi.hoisted(() => ({
	interpolatedCurrentTime: 0,
	musicPlayBackRate: 1,
	musicPlaying: false,
	resumeOrSeekMusic: vi.fn(),
}));
vi.mock("$/modules/audio/audio-engine", () => ({ audioEngine: audio }));
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

// A user's AutoHotkey map, now built in: two keys per sync action.
const EXTRAS = { syncStart: "KeyZ", syncNext: "KeyX", syncEnd: "KeyC" };

let cleanup = () => {};
beforeEach(() => {
	localStorage.clear();
	window.dispatchEvent(new Event("blur"));
	for (const [id, code] of Object.entries(EXTRAS))
		localStorage.setItem(
			extraKeyBindingsStorageKey(id),
			JSON.stringify([[code]]),
		);
});
afterEach(() => {
	cleanup();
	createStore().set(keyBindingTriggerModeAtom, KeyBindingTriggerMode.KeyDown);
});

function mount(mode: KeyBindingTriggerMode) {
	const store = createStore();
	store.set(keyBindingTriggerModeAtom, mode);
	const word = (text: string) => ({ ...newLyricWord(), word: text });
	const first = { ...newLyricLine(), words: [..."abcdef"].map(word) };
	const second = { ...newLyricLine(), words: [..."ghi"].map(word) };
	store.set(lyricLinesAtom, { metadata: [], lyricLines: [first, second] });
	store.set(selectedLinesAtom, new Set([first.id]));
	store.set(selectedWordsAtom, new Set([first.words[0].id]));
	store.set(syncLevelModeAtom, "word");
	store.set(syncTimeOffsetAtom, 0);
	store.set(syncCommitOffsetAtom, 0);
	store.set(smartLastWordAtom, false);
	store.set(backgroundSyncLaneAtom, "all");
	const root = createRoot(document.createElement("div"));
	act(() =>
		root.render(
			<Provider store={store}>
				<SyncKeyBinding />
			</Provider>,
		),
	);
	cleanup = () => act(() => root.unmount());
	return store;
}

function key(type: "keydown" | "keyup", code: string) {
	act(() => {
		window.dispatchEvent(
			new KeyboardEvent(type, { code, bubbles: true, cancelable: true }),
		);
	});
}

/**
 * Rolled presses, as when syncing fast: each key goes down before the previous
 * one comes up (a repeated key has to come up first). Press `i` fires at
 * second `i + 1` in either trigger mode.
 */
function roll(codes: string[], mode: KeyBindingTriggerMode) {
	codes.forEach((code, index) => {
		const previous = codes[index - 1];
		const release = () => {
			if (previous === undefined) return;
			if (mode === KeyBindingTriggerMode.KeyUp)
				audio.interpolatedCurrentTime = index;
			key("keyup", previous);
		};
		if (previous === code) release();
		if (mode === KeyBindingTriggerMode.KeyDown)
			audio.interpolatedCurrentTime = index + 1;
		key("keydown", code);
		if (previous !== code) release();
	});
	audio.interpolatedCurrentTime = codes.length;
	key("keyup", codes[codes.length - 1]);
}

function timings(store: ReturnType<typeof createStore>) {
	return store
		.get(lyricLinesAtom)
		.lyricLines.map((line) =>
			line.words.map((word) => [word.startTime, word.endTime]),
		);
}

const EXPECTED = [
	[
		[1000, 2000],
		[2000, 3000],
		[3000, 4000],
		[4000, 5000],
		[5000, 6000],
		[6000, 7000],
	],
	[
		[8000, 9000],
		[9000, 10000],
		[10000, 11000],
	],
];

describe.each([
	KeyBindingTriggerMode.KeyDown,
	KeyBindingTriggerMode.KeyUp,
])("F/G/H with two keys each (%s)", (mode) => {
	it("fires every fast alternating press, primary and second key alike", () => {
		const store = mount(mode);
		roll(
			[
				...["KeyZ", "KeyG", "KeyX", "KeyG", "KeyX", "KeyG", "KeyC"],
				...["KeyF", "KeyX", "KeyG", "KeyH"],
			],
			mode,
		);
		expect(timings(store)).toEqual(EXPECTED);
	});

	it("syncs the same with the primary keys alone", () => {
		const store = mount(mode);
		roll(
			[
				...["KeyF", "KeyG", "KeyG", "KeyG", "KeyG", "KeyG", "KeyH"],
				...["KeyF", "KeyG", "KeyG", "KeyH"],
			],
			mode,
		);
		expect(timings(store)).toEqual(EXPECTED);
	});
});
