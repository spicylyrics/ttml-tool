import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { getCurrentLocation } from "$/modules/lyric-editor/utils/lyric-states";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import {
	canUndoLyricLinesAtom,
	isDirtyAtom,
	LYRIC_HISTORY_LIMIT,
	lyricLinesAtom,
	markLyricsSavedAtom,
	repairSelection,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	startFreshLyricDocumentAtom,
	ToolMode,
	toolModeAtom,
	undoableLyricLinesAtom,
	undoLyricLinesAtom,
} from "./main";

const lyric = (id: string): TTMLLyric => ({
	lyricLines: [{ ...newLyricLine(), words: [{ ...newLyricWord(), word: id }] }],
	metadata: [{ key: "id", value: [id] }],
});

// Mirrors the app: the editor writes lyricLinesAtom directly while the history
// atom stays mounted (useTopMenuActions subscribes to it).
const mountedStore = () => {
	const store = createStore();
	store.sub(undoableLyricLinesAtom, () => {});
	store.sub(isDirtyAtom, () => {});
	return store;
};

describe("dirty state", () => {
	it("does not warn for an empty editor with metadata or a custom name", () => {
		const store = mountedStore();
		store.set(lyricLinesAtom, {
			lyricLines: [],
			metadata: [{ key: "musicName", value: ["Tagged audio"] }],
		});
		store.set(saveFileNameAtom, "My song.ttml");
		expect(store.get(isDirtyAtom)).toBe(false);
	});

	it("renaming a saved lyric document does not dirty its lyrics", () => {
		const store = mountedStore();
		store.set(lyricLinesAtom, lyric("a"));
		store.set(startFreshLyricDocumentAtom);
		store.set(saveFileNameAtom, "Renamed.ttml");
		expect(store.get(isDirtyAtom)).toBe(false);
	});
	it("tracks edits via undo history before any save", () => {
		const store = mountedStore();
		expect(store.get(isDirtyAtom)).toBe(false);
		store.set(lyricLinesAtom, lyric("a"));
		expect(store.get(isDirtyAtom)).toBe(true);
	});

	it("marks the saved snapshot clean without clearing undo history", () => {
		const store = mountedStore();
		const edited = lyric("a");
		store.set(lyricLinesAtom, edited);
		store.set(markLyricsSavedAtom, edited);
		expect(store.get(isDirtyAtom)).toBe(false);
		expect(store.get(undoableLyricLinesAtom).canUndo).toBe(true);
	});

	it("stays dirty when edits land while a save is in flight", () => {
		const store = mountedStore();
		const snapshot = lyric("a");
		store.set(lyricLinesAtom, snapshot);
		store.set(lyricLinesAtom, lyric("b"));
		store.set(markLyricsSavedAtom, snapshot);
		expect(store.get(isDirtyAtom)).toBe(true);
	});

	it("reads clean again after undoing back to the saved version", () => {
		const store = mountedStore();
		const saved = lyric("a");
		store.set(lyricLinesAtom, saved);
		store.set(markLyricsSavedAtom, saved);
		store.set(lyricLinesAtom, lyric("b"));
		expect(store.get(isDirtyAtom)).toBe(true);
		store.set(undoLyricLinesAtom);
		expect(store.get(lyricLinesAtom)).toBe(saved);
		expect(store.get(isDirtyAtom)).toBe(false);
	});

	it("starts a fresh document clean with no undo history", () => {
		const store = mountedStore();
		store.set(lyricLinesAtom, lyric("a"));
		store.set(lyricLinesAtom, lyric("opened"));
		store.set(startFreshLyricDocumentAtom);
		expect(store.get(isDirtyAtom)).toBe(false);
		expect(store.get(undoableLyricLinesAtom).canUndo).toBe(false);
	});
});

describe("undo history", () => {
	it("keeps far more than the old ten steps", () => {
		const store = mountedStore();
		store.set(lyricLinesAtom, lyric("start"));
		for (let i = 0; i < 100; i++) store.set(lyricLinesAtom, lyric(`edit ${i}`));
		let undone = 0;
		while (store.get(canUndoLyricLinesAtom)) {
			store.set(undoLyricLinesAtom);
			undone++;
		}
		expect(undone).toBe(101);
		expect(store.get(lyricLinesAtom).lyricLines).toHaveLength(0);
	});

	it("caps history at the limit instead of growing forever", () => {
		const store = mountedStore();
		for (let i = 0; i < LYRIC_HISTORY_LIMIT + 50; i++)
			store.set(lyricLinesAtom, lyric(`edit ${i}`));
		let undone = 0;
		while (store.get(canUndoLyricLinesAtom)) {
			store.set(undoLyricLinesAtom);
			undone++;
		}
		expect(undone).toBeLessThanOrEqual(LYRIC_HISTORY_LIMIT);
		expect(undone).toBeGreaterThan(LYRIC_HISTORY_LIMIT - 5);
	});
});

describe("repairSelection", () => {
	const doc = lyric("one");
	const line = doc.lyricLines[0];

	it("drops ids that no longer exist", () => {
		const repaired = repairSelection(
			doc,
			{ lines: new Set([line.id, "gone"]), words: new Set(["missing"]) },
			false,
		);
		expect(repaired.lines).toEqual(new Set([line.id]));
		expect(repaired.words.size).toBe(0);
	});

	it("falls back to the line's first word for keyboard sync", () => {
		const repaired = repairSelection(
			doc,
			{ lines: new Set([line.id]), words: new Set(["missing"]) },
			true,
		);
		expect(repaired.words).toEqual(new Set([line.words[0].id]));
	});
});

describe("undo after a split", () => {
	it("re-selects the word that was split, so sync keys keep working", () => {
		const store = mountedStore();
		store.set(toolModeAtom, ToolMode.Sync);
		const whole = { ...newLyricWord(), word: "whole" };
		const line = { ...newLyricLine(), words: [whole] };
		store.set(lyricLinesAtom, { lyricLines: [line], metadata: [] });
		store.set(selectedLinesAtom, new Set([line.id]));
		store.set(selectedWordsAtom, new Set([whole.id]));
		const parts = [
			{ ...newLyricWord(), word: "who" },
			{ ...newLyricWord(), word: "le" },
		];
		store.set(lyricLinesAtom, {
			lyricLines: [{ ...line, words: parts }],
			metadata: [],
		});
		store.set(selectedWordsAtom, new Set([parts[0].id]));
		store.set(undoLyricLinesAtom);
		expect(store.get(selectedWordsAtom)).toEqual(new Set([whole.id]));
		expect(getCurrentLocation(store)?.word.id).toBe(whole.id);
	});
});
