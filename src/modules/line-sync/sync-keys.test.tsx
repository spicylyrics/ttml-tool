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
import { newLyricLine, newLyricWord, type TimingMode } from "$/types/ttml";
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

function mount({
	enabled,
	timingMode,
	bounded,
}: {
	enabled: boolean;
	timingMode?: TimingMode;
	bounded: boolean;
}) {
	bindings.clear();
	const store = createStore();
	const words = ["a", " ", "bbb"].map((word) => ({ ...newLyricWord(), word }));
	const first = {
		...newLyricLine(),
		words,
		startTime: bounded ? 1000 : 0,
		endTime: bounded ? 3000 : 0,
		lineBoundsSynced: bounded,
	};
	const second = {
		...newLyricLine(),
		words: [{ ...newLyricWord(), word: "next" }],
		startTime: bounded ? 4000 : 0,
		endTime: bounded ? 6000 : 0,
		lineBoundsSynced: bounded,
	};
	store.set(lyricLinesAtom, {
		metadata: [],
		lyricLines: [first, second],
		timingMode,
	});
	store.set(selectedLinesAtom, new Set([first.id]));
	store.set(selectedWordsAtom, new Set([words[0].id]));
	store.set(lineSyncEnabledAtom, enabled);
	store.set(syncLevelModeAtom, "word");
	store.set(syncTimeOffsetAtom, 0);
	store.set(syncCommitOffsetAtom, 0);
	store.set(smartLastWordAtom, false);
	store.set(backgroundSyncLaneAtom, "all");
	const root = createRoot(globalThis.document.createElement("div"));
	act(() =>
		root.render(
			<Provider store={store}>
				<SyncKeyBindings />
			</Provider>,
		),
	);
	// jsdom here has no localStorage, so the stored flag reloads its default on
	// mount; set it again once mounted.
	act(() => store.set(lineSyncEnabledAtom, enabled));
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

describe("R48 word syncing inside synced line bounds", () => {
	it("G on the last word past the line end ends it at the line end and moves on", () => {
		const view = mount({ enabled: true, timingMode: "word", bounded: true });
		try {
			press(keySyncStartAtom, 0.5);
			press(keySyncNextAtom, 2);
			press(keySyncNextAtom, 3.5);
			const [first, second] = view.store.get(lyricLinesAtom).lyricLines;
			expect(first.words.map((w) => [w.startTime, w.endTime])).toEqual([
				[1000, 2000],
				[0, 0],
				[2000, 3000],
			]);
			expect(first).toMatchObject({ startTime: 1000, endTime: 3000 });
			expect(second.words[0].startTime).toBe(4000);
			expect(second).toMatchObject({ startTime: 4000, endTime: 6000 });
			expect(view.store.get(selectedLinesAtom)).toEqual(new Set([second.id]));
		} finally {
			view.cleanup();
		}
	});

	it("does nothing while the feature is off", () => {
		const view = mount({ enabled: false, timingMode: "word", bounded: true });
		try {
			press(keySyncStartAtom, 0.5);
			press(keySyncNextAtom, 2);
			press(keySyncNextAtom, 3.5);
			const [first, second] = view.store.get(lyricLinesAtom).lyricLines;
			expect(first.words[0].startTime).toBe(500);
			expect(first).toMatchObject({ startTime: 500, endTime: 3500 });
			expect(second.words[0].startTime).toBe(3500);
		} finally {
			view.cleanup();
		}
	});

	it("leaves lines without synced bounds to normal word syncing", () => {
		const view = mount({ enabled: true, timingMode: "word", bounded: false });
		try {
			press(keySyncStartAtom, 0.5);
			press(keySyncNextAtom, 2);
			press(keySyncEndAtom, 3.5);
			const [first] = view.store.get(lyricLinesAtom).lyricLines;
			expect(first).toMatchObject({ startTime: 500, endTime: 3500 });
		} finally {
			view.cleanup();
		}
	});
});

describe("Line-mode keys", () => {
	it("F, G and H time whole lines", () => {
		const view = mount({ enabled: true, timingMode: "line", bounded: false });
		try {
			press(keySyncStartAtom, 1);
			press(keySyncNextAtom, 3);
			expect(view.store.get(selectedLinesAtom)).toEqual(
				new Set([view.second.id]),
			);
			expect(view.store.get(selectedWordsAtom)).toEqual(
				new Set([view.second.words[0].id]),
			);
			press(keySyncEndAtom, 5);
			const [first, second] = view.store.get(lyricLinesAtom).lyricLines;
			expect(first).toMatchObject({
				startTime: 1000,
				endTime: 3000,
				isLineSynced: true,
			});
			expect(first.words[2]).toMatchObject({ startTime: 1000, endTime: 3000 });
			expect(second).toMatchObject({ startTime: 3000, endTime: 5000 });
		} finally {
			view.cleanup();
		}
	});

	it("keeps word keys when the feature is off, even in a Line-mode song", () => {
		const view = mount({ enabled: false, timingMode: "line", bounded: false });
		try {
			press(keySyncStartAtom, 1);
			press(keySyncNextAtom, 3);
			expect(view.store.get(selectedWordsAtom)).toEqual(
				new Set([view.words[2].id]),
			);
		} finally {
			view.cleanup();
		}
	});
});
