import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import {
	canUndoLyricLinesAtom,
	isDirtyAtom,
	LYRIC_HISTORY_LIMIT,
	lyricLinesAtom,
	markLyricsSavedAtom,
	saveFileNameAtom,
	startFreshLyricDocumentAtom,
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
	it("keeps far more than ten steps, enough for a song of sync presses", () => {
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
