// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { lyricLinesOnlyAtom } from "$/modules/lyric-editor/states/document-structure";
import type { SyncLane } from "$/modules/lyric-editor/utils/lyric-states";
import { processedLyricLinesAtom } from "$/modules/segmentation/utils/segment-processing";
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
import { SyncKeyBinding } from "./sync-keybinding";

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

function mount(mode: "word" | "line" = "word") {
	bindings.clear();
	const store = createStore();
	const words = ["a", " ", "bbb"].map((word) => ({ ...newLyricWord(), word }));
	const first = { ...newLyricLine(), words };
	const second = {
		...newLyricLine(),
		words: [{ ...newLyricWord(), word: "next" }],
	};
	const document = { metadata: [], lyricLines: [first, second] };
	store.set(lyricLinesAtom, document);
	store.set(selectedLinesAtom, new Set([first.id]));
	store.set(selectedWordsAtom, new Set([words[0].id]));
	store.set(syncLevelModeAtom, mode);
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
	return {
		store,
		document,
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

describe("normal-word sync controls", () => {
	it("updates F, G and H without repeated line-ID searches in a 10,000-line song", () => {
		const view = mount();
		const lines = Array.from({ length: 10_000 }, (_, index) => ({
			...newLyricLine(),
			id: `perf-line-${index}`,
			words: [{ ...newLyricWord(), word: "next" }],
		}));
		lines[5000] = { ...view.first, id: "perf-line-5000" };
		view.store.set(lyricLinesAtom, { metadata: [], lyricLines: lines });
		view.store.set(selectedLinesAtom, new Set([lines[5000].id]));
		const listChanged = vi.fn();
		const unsubscribes = [view.store.sub(lyricLinesOnlyAtom, listChanged)];
		const rows = view.store.get(lyricLinesOnlyAtom);
		for (const row of rows.slice(4975, 5025))
			unsubscribes.push(view.store.sub(row, () => {}));
		const indexOf = Array.prototype.indexOf;
		let lineSearches = 0;
		const spy = vi
			.spyOn(Array.prototype, "indexOf")
			.mockImplementation(function (
				this: unknown[],
				value: unknown,
				from?: number,
			) {
				if (typeof value === "string" && value.startsWith("perf-line-"))
					lineSearches++;
				return indexOf.call(this, value, from);
			});
		try {
			press(keySyncStartAtom, 1);
			press(keySyncNextAtom, 2);
			press(keySyncEndAtom, 3);
			expect(lineSearches).toBe(0);
			expect(view.store.get(lyricLinesOnlyAtom)).toBe(rows);
			expect(listChanged).not.toHaveBeenCalled();
			expect(
				view.store
					.get(rows[5000])
					.words.map((word) => [word.startTime, word.endTime]),
			).toEqual([
				[1000, 2000],
				[0, 0],
				[2000, 3000],
			]);
			expect(view.store.get(selectedLinesAtom)).toEqual(
				new Set([lines[5001].id]),
			);
		} finally {
			spy.mockRestore();
			for (const unsubscribe of unsubscribes) unsubscribe();
			view.cleanup();
		}
	});

	it.each([
		keySyncNextAtom,
		keySyncEndAtom,
	])("updates the timeline after each completed span without waiting for line end", (key) => {
		const view = mount();
		try {
			press(keySyncStartAtom, 1);
			const before = view.store.get(processedLyricLinesAtom);
			expect(before[0].segments).toEqual([]);
			press(key, 2);
			const after = view.store.get(processedLyricLinesAtom);
			expect(after[0]).toMatchObject({ startTime: 1000, endTime: 2000 });
			expect(after[0].segments).toEqual([
				expect.objectContaining({
					id: view.words[0].id,
					type: "word",
					startTime: 1000,
					endTime: 2000,
				}),
			]);
			expect(view.store.get(lyricLinesAtom).lyricLines[0].endTime).toBe(0);
			expect(view.store.get(selectedLinesAtom)).toEqual(
				new Set([view.first.id]),
			);
		} finally {
			view.cleanup();
		}
	});

	it("F starts, G commits and advances past spaces, and H ends the last word", () => {
		const view = mount();
		try {
			press(keySyncStartAtom, 1);
			press(keySyncNextAtom, 2);
			expect(view.store.get(selectedWordsAtom)).toEqual(
				new Set([view.words[2].id]),
			);
			press(keySyncEndAtom, 3);
			const [first, second] = view.store.get(lyricLinesAtom).lyricLines;
			expect(first.words.map((word) => [word.startTime, word.endTime])).toEqual(
				[
					[1000, 2000],
					[0, 0],
					[2000, 3000],
				],
			);
			expect(first).toMatchObject({ startTime: 1000, endTime: 3000 });
			expect(view.store.get(selectedLinesAtom)).toEqual(new Set([second.id]));
			expect(view.store.get(selectedWordsAtom)).toEqual(
				new Set([second.words[0].id]),
			);
			expect(
				view.document.lyricLines[0].words.every(
					(word) => word.startTime === 0 && word.endTime === 0,
				),
			).toBe(true);
		} finally {
			view.cleanup();
		}
	});

	it("G on the song's last word ends the last line", () => {
		const view = mount();
		try {
			view.store.set(selectedLinesAtom, new Set([view.second.id]));
			view.store.set(selectedWordsAtom, new Set([view.second.words[0].id]));
			press(keySyncStartAtom, 4);
			press(keySyncNextAtom, 5);
			const second = view.store.get(lyricLinesAtom).lyricLines[1];
			expect(second.words[0]).toMatchObject({ startTime: 4000, endTime: 5000 });
			expect(second).toMatchObject({ startTime: 4000, endTime: 5000 });
		} finally {
			view.cleanup();
		}
	});

	it.each([
		keySyncNextAtom,
		keySyncEndAtom,
	])("distributes line timing by characters and advances in line mode", (key) => {
		const view = mount("line");
		try {
			press(keySyncStartAtom, 1);
			press(key, 2);
			const [first, second] = view.store.get(lyricLinesAtom).lyricLines;
			expect(first.words.map((word) => [word.startTime, word.endTime])).toEqual(
				[
					[1000, 1250],
					[1250, 1250],
					[1250, 2000],
				],
			);
			expect(first).toMatchObject({ startTime: 1000, endTime: 2000 });
			expect(view.store.get(selectedLinesAtom)).toEqual(new Set([second.id]));
			expect(view.store.get(selectedWordsAtom)).toEqual(
				new Set([second.words[0].id]),
			);
			expect(second.words[0].startTime).toBe(
				key === keySyncNextAtom ? 2000 : 0,
			);
		} finally {
			view.cleanup();
		}
	});
});

function mountWithBackground(lane: SyncLane) {
	const view = mount();
	const line = (word: string, isBG = false) => ({
		...newLyricLine(),
		isBG,
		words: [{ ...newLyricWord(), word }],
	});
	const lines = [
		line("main1"),
		line("bg1", true),
		line("main2"),
		line("bg2", true),
	];
	view.store.set(lyricLinesAtom, { metadata: [], lyricLines: lines });
	view.store.set(backgroundSyncLaneAtom, lane);
	const select = (index: number) => {
		view.store.set(selectedLinesAtom, new Set([lines[index].id]));
		view.store.set(selectedWordsAtom, new Set([lines[index].words[0].id]));
	};
	const selectedLine = () =>
		lines.findIndex((l) => view.store.get(selectedLinesAtom).has(l.id));
	const synced = () => view.store.get(lyricLinesAtom).lyricLines;
	return { ...view, select, selectedLine, synced };
}

describe("background lines while syncing", () => {
	it("inline: H on a main line's last word moves into its background line", () => {
		const view = mountWithBackground("all");
		try {
			view.select(0);
			press(keySyncEndAtom, 2);
			expect(view.selectedLine()).toBe(1);
		} finally {
			view.cleanup();
		}
	});

	it("separate pass: H and G stay on main lines and leave background untouched", () => {
		const view = mountWithBackground("same");
		try {
			view.select(0);
			press(keySyncEndAtom, 2);
			expect(view.selectedLine()).toBe(2);
			view.select(0);
			press(keySyncNextAtom, 3);
			expect(view.selectedLine()).toBe(2);
			const [main1, bg1, main2] = view.synced();
			expect(main1.endTime).toBe(3000);
			expect(main2).toMatchObject({ startTime: 3000 });
			expect(bg1).toMatchObject({ startTime: 0, endTime: 0 });
			expect(bg1.words[0]).toMatchObject({ startTime: 0, endTime: 0 });
		} finally {
			view.cleanup();
		}
	});

	it("separate pass: starting on a background line walks background lines only", () => {
		const view = mountWithBackground("same");
		try {
			view.select(1);
			press(keySyncEndAtom, 2);
			expect(view.selectedLine()).toBe(3);
			expect(view.synced()[2].words[0]).toMatchObject({
				startTime: 0,
				endTime: 0,
			});
		} finally {
			view.cleanup();
		}
	});

	it("separate pass applies to Sync by: Line too", () => {
		const view = mountWithBackground("same");
		try {
			view.store.set(syncLevelModeAtom, "line");
			view.select(0);
			press(keySyncNextAtom, 2);
			expect(view.selectedLine()).toBe(2);
			expect(view.synced()[1].startTime).toBe(0);
		} finally {
			view.cleanup();
		}
	});
});
