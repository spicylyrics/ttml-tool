// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SyncKeyBinding } from "$/modules/lyric-editor/components/sync-keybinding";
import { smartLastWordAtom } from "$/modules/settings/states";
import { backgroundSyncLaneAtom } from "$/modules/settings/states/background-sync";
import {
	syncCommitOffsetAtom,
	syncLevelModeAtom,
	syncTimeOffsetAtom,
} from "$/modules/settings/states/sync";
import { keySyncNextAtom, keySyncStartAtom } from "$/states/keybindings";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import type { KeyBindingCallback } from "$/utils/keybindings";
import { combineSelectedWord } from "./word-actions";

const bindings = vi.hoisted(() => new Map<object, KeyBindingCallback>());
const audio = vi.hoisted(() => ({
	interpolatedCurrentTime: 0,
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
	const line = {
		...newLyricLine(),
		words: ["beau", "ti", "ful", " ", "day"].map((word) => ({
			...newLyricWord(),
			word,
		})),
	};
	store.set(lyricLinesAtom, { metadata: [], lyricLines: [line] });
	store.set(selectedLinesAtom, new Set([line.id]));
	store.set(selectedWordsAtom, new Set([line.words[0].id]));
	store.set(syncLevelModeAtom, "word");
	store.set(syncTimeOffsetAtom, 0);
	store.set(syncCommitOffsetAtom, 0);
	store.set(smartLastWordAtom, false);
	store.set(backgroundSyncLaneAtom, "all");
	const root = createRoot(globalThis.document.createElement("div"));
	act(() =>
		root.render(
			<Provider store={store}>
				<SyncKeyBinding />
			</Provider>,
		),
	);
	return { store, cleanup: () => act(() => root.unmount()) };
}

/** Presses a sync key at `seconds`. */
function press(key: object, seconds: number) {
	audio.interpolatedCurrentTime = seconds;
	const callback = bindings.get(key);
	if (!callback) throw new Error("Missing sync binding");
	const now = performance.now();
	act(() => callback({ downTime: now, downTimeOffset: 0, triggerTime: now }));
}

describe("combining a word in Time mode", () => {
	it("keeps the combined word selected so F, G and H carry on from it", () => {
		const view = mount();
		try {
			const { store } = view;
			combineSelectedWord(store, "next");
			const [combined] = store.get(lyricLinesAtom).lyricLines[0].words;
			expect(store.get(selectedWordsAtom)).toEqual(new Set([combined.id]));

			press(keySyncStartAtom, 1);
			press(keySyncNextAtom, 1.5);
			const words = store.get(lyricLinesAtom).lyricLines[0].words;
			expect(words.map((w) => [w.word, w.startTime, w.endTime])).toEqual([
				["beauti", 1000, 1500],
				["ful", 1500, 0],
				[" ", 0, 0],
				["day", 0, 0],
			]);
		} finally {
			view.cleanup();
		}
	});
});
