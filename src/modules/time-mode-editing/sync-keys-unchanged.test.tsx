// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { SyncKeyBindings } from "$/modules/line-sync/LineSyncKeyBinding";
import { lineSyncEnabledAtom } from "$/modules/line-sync/states";
import { smartLastWordAtom } from "$/modules/settings/states";
import { backgroundSyncLaneAtom } from "$/modules/settings/states/background-sync";
import {
	syncCommitOffsetAtom,
	syncLevelModeAtom,
	syncTimeOffsetAtom,
} from "$/modules/settings/states/sync";
import {
	keySyncEndAtom,
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
import { combineWithNeighbor } from "./combine-neighbors";
import { timeModeWordEditingEnabledAtom } from "./states";

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

const TEXT = [
	["beau", "ti", "ful", " ", "day"],
	["fast", "taps", "here"],
];

function mount(enabled: boolean) {
	bindings.clear();
	const store = createStore();
	// Fixed ids so runs with the flag on and off can be compared directly.
	let id = 0;
	const lines = TEXT.map((words, lineIndex) => ({
		...newLyricLine(),
		id: `line-${lineIndex}`,
		words: words.map((word) => ({
			...newLyricWord(),
			id: `word-${id++}`,
			word,
		})),
	}));
	store.set(lyricLinesAtom, { metadata: [], lyricLines: lines });
	store.set(selectedLinesAtom, new Set([lines[0].id]));
	store.set(selectedWordsAtom, new Set([lines[0].words[0].id]));
	store.set(syncLevelModeAtom, "word");
	store.set(syncTimeOffsetAtom, 0);
	store.set(syncCommitOffsetAtom, 0);
	store.set(smartLastWordAtom, false);
	store.set(backgroundSyncLaneAtom, "all");
	store.set(lineSyncEnabledAtom, false);
	const root = createRoot(globalThis.document.createElement("div"));
	act(() =>
		root.render(
			<Provider store={store}>
				<SyncKeyBindings />
			</Provider>,
		),
	);
	// jsdom has no localStorage here, so set the stored flag again once mounted.
	act(() => store.set(timeModeWordEditingEnabledAtom, enabled));
	return { store, cleanup: () => act(() => root.unmount()) };
}

/** Presses a key at `seconds`; `downTime` lets fast taps share one frame. */
function press(key: object, seconds: number, downTime = performance.now()) {
	audio.interpolatedCurrentTime = seconds;
	const callback = bindings.get(key);
	if (!callback) throw new Error("Missing sync binding");
	act(() => callback({ downTime, downTimeOffset: 0, triggerTime: downTime }));
}

function snapshot(store: ReturnType<typeof createStore>) {
	return {
		lines: store.get(lyricLinesAtom).lyricLines.map((line) => ({
			startTime: line.startTime,
			endTime: line.endTime,
			words: line.words.map((w) => [w.word, w.startTime, w.endTime]),
		})),
		selectedLines: [...store.get(selectedLinesAtom)],
		selectedWords: [...store.get(selectedWordsAtom)],
	};
}

/** One F/G/H pass: a normal line, then a line of taps faster than a frame. */
function syncPass(rate: number) {
	audio.musicPlayBackRate = rate;
	press(keySyncStartAtom, 1);
	press(keySyncNextAtom, 1.2);
	press(keySyncNextAtom, 1.4);
	press(keySyncNextAtom, 2);
	press(keySyncEndAtom, 2.6);
	press(keySyncStartAtom, 3);
	const frame = performance.now();
	press(keySyncNextAtom, 3.01, frame);
	press(keySyncNextAtom, 3.02, frame + 1);
	press(keySyncEndAtom, 3.03, frame + 2);
}

describe("F, G and H with Time-mode word editing on", () => {
	for (const rate of [0.5, 1]) {
		it(`give the same timings as with it off at ${rate}x`, () => {
			const results = [false, true].map((enabled) => {
				const view = mount(enabled);
				try {
					syncPass(rate);
					return snapshot(view.store);
				} finally {
					view.cleanup();
				}
			});
			expect(results[1]).toEqual(results[0]);
			// Sanity check that the pass actually timed something.
			expect(results[0].lines[0].words[0]).toEqual(["beau", 1000, 1200]);
		});
	}

	it("keep syncing from a word combined in Time mode", () => {
		const view = mount(true);
		try {
			const { store } = view;
			const lines = store.get(lyricLinesAtom).lyricLines;
			const result = combineWithNeighbor(lines[0].words, 0, "next");
			if (!result) throw new Error("expected a combine");
			store.set(lyricLinesAtom, {
				...store.get(lyricLinesAtom),
				lyricLines: [{ ...lines[0], words: result.words }, lines[1]],
			});
			store.set(selectedWordsAtom, new Set([result.combined.id]));

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
