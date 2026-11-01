// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { LineSyncKeyBinding } from "$/modules/line-sync/LineSyncKeyBinding";
import { SyncKeyBinding } from "$/modules/lyric-editor/components/sync-keybinding";
import { smartLastWordAtom } from "$/modules/settings/states";
import { backgroundSyncLaneAtom } from "$/modules/settings/states/background-sync";
import {
	syncCommitOffsetAtom,
	syncTimeOffsetAtom,
} from "$/modules/settings/states/sync";
import {
	keySyncLineEndAtom,
	keySyncLineNextAtom,
	keySyncLineStartAtom,
	keySyncNextAtom,
	keySyncStartAtom,
} from "$/states/keybindings";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import type { KeyBindingCallback } from "$/utils/keybindings";

const bindings = vi.hoisted(() => new Map<object, KeyBindingCallback>());
const audio = vi.hoisted(() => ({
	interpolatedCurrentTime: 1,
	musicPlayBackRate: 1,
	musicPlaying: false,
	resumeOrSeekMusic: vi.fn(),
}));
vi.mock("$/modules/audio/audio-engine", () => ({ audioEngine: audio }));
vi.mock("$/utils/keybindings", async (importOriginal) => ({
	...(await importOriginal<typeof import("$/utils/keybindings")>()),
	useKeyBindingAtom: (key: object, callback: KeyBindingCallback) =>
		bindings.set(key, callback),
}));
(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

function mount() {
	bindings.clear();
	const store = createStore();
	const words = ["a", " ", "bbb"].map((word) => ({ ...newLyricWord(), word }));
	const first = { ...newLyricLine(), words };
	const second = {
		...newLyricLine(),
		words: [{ ...newLyricWord(), word: "next" }],
	};
	store.set(lyricLinesAtom, { metadata: [], lyricLines: [first, second] });
	store.set(selectedLinesAtom, new Set([first.id]));
	store.set(selectedWordsAtom, new Set([words[0].id]));
	store.set(syncTimeOffsetAtom, 0);
	store.set(syncCommitOffsetAtom, 0);
	store.set(smartLastWordAtom, false);
	store.set(backgroundSyncLaneAtom, "all");
	const root = createRoot(globalThis.document.createElement("div"));
	act(() =>
		root.render(
			<Provider store={store}>
				<SyncKeyBinding />
				<LineSyncKeyBinding />
			</Provider>,
		),
	);
	return {
		store,
		first,
		second,
		words,
		cleanup: () => act(() => root.unmount()),
	};
}

function press(key: object, seconds: number) {
	audio.interpolatedCurrentTime = seconds;
	const callback = bindings.get(key);
	if (!callback) throw new Error("Missing sync binding");
	const now = performance.now();
	act(() => callback({ downTime: now, downTimeOffset: 0, triggerTime: now }));
}

describe("whole-line timing keys", () => {
	it("time whole lines and leave the words untimed", () => {
		const view = mount();
		try {
			press(keySyncLineStartAtom, 1);
			press(keySyncLineNextAtom, 3);
			expect(view.store.get(selectedLinesAtom)).toEqual(
				new Set([view.second.id]),
			);
			expect(view.store.get(selectedWordsAtom)).toEqual(
				new Set([view.second.words[0].id]),
			);
			press(keySyncLineEndAtom, 5);
			const [first, second] = view.store.get(lyricLinesAtom).lyricLines;
			expect(first).toMatchObject({ startTime: 1000, endTime: 3000 });
			expect(first.words).toBe(view.words);
			expect(second).toMatchObject({ startTime: 3000, endTime: 5000 });
			expect(second.words[0]).toMatchObject({ startTime: 0, endTime: 0 });
		} finally {
			view.cleanup();
		}
	});

	it("sit next to word syncing, which F and G still do", () => {
		const view = mount();
		try {
			press(keySyncStartAtom, 1);
			press(keySyncNextAtom, 3);
			expect(view.store.get(selectedWordsAtom)).toEqual(
				new Set([view.words[2].id]),
			);
			const [first] = view.store.get(lyricLinesAtom).lyricLines;
			expect(first.words[0]).toMatchObject({ startTime: 1000, endTime: 3000 });
		} finally {
			view.cleanup();
		}
	});
});
