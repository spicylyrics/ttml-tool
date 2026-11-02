import { produce } from "immer";
import { createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	canRedoLyricLinesAtom,
	canUndoLyricLinesAtom,
	lyricLinesAtom,
	lyricMetadataAtom,
	projectIdentityAtom,
} from "./main";

// App-wide chrome (menu bar, file header) reads these instead of the whole
// document, so a sync key press on a long song doesn't re-render it.
describe("document-wide atoms for app chrome", () => {
	it("stays quiet through repeated word timing edits", () => {
		const store = createStore();
		store.set(lyricLinesAtom, {
			metadata: [{ key: "musicName", value: ["Song"] }],
			lyricLines: Array.from({ length: 180 }, () => ({
				...newLyricLine(),
				words: Array.from({ length: 14 }, () => newLyricWord()),
			})),
		});
		const metadata = vi.fn();
		const identity = vi.fn();
		const canUndo = vi.fn();
		const canRedo = vi.fn();
		const unsubscribes = [
			store.sub(lyricMetadataAtom, metadata),
			store.sub(projectIdentityAtom, identity),
			store.sub(canUndoLyricLinesAtom, canUndo),
			store.sub(canRedoLyricLinesAtom, canRedo),
		];
		const pressSyncKey = (press: number) =>
			store.set(
				lyricLinesAtom,
				produce(store.get(lyricLinesAtom), (draft) => {
					draft.lyricLines[90].words[press % 14].startTime = press * 100;
				}),
			);

		for (let press = 1; press <= 30; press++) pressSyncKey(press);

		expect(metadata).not.toHaveBeenCalled();
		expect(identity).not.toHaveBeenCalled();
		// Undo may switch on once; it must not fire for every press.
		expect(canUndo.mock.calls.length).toBeLessThanOrEqual(1);
		expect(store.get(canUndoLyricLinesAtom)).toBe(true);
		expect(canRedo).not.toHaveBeenCalled();
		for (const unsubscribe of unsubscribes) unsubscribe();
	});
});
