import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
	lyricLinesAtom,
	startFreshLyricDocumentAtom,
	undoableLyricLinesAtom,
	undoLyricLinesAtom,
} from "$/states/main";
import { newLyricLine, type TTMLLyric } from "$/types/ttml";
import { swapDuetLines, swapDuetLinesAtom } from "./swap-duet";

const doc = (): TTMLLyric => ({
	lyricLines: [
		{ ...newLyricLine(), id: "a", isDuet: false },
		{ ...newLyricLine(), id: "b", isDuet: true },
		{ ...newLyricLine(), id: "c", isDuet: false, isBG: true },
	],
	metadata: [],
});

const duets = (lyric: TTMLLyric) => lyric.lyricLines.map((line) => line.isDuet);

describe("swapDuetLines", () => {
	it("flips every line, background lines included", () => {
		expect(duets(swapDuetLines(doc()))).toEqual([true, false, true]);
	});

	it("flips only the given lines and their group", () => {
		expect(duets(swapDuetLines(doc(), new Set(["b", "c"])))).toEqual([
			false,
			false,
			true,
		]);
	});

	it("moves a lead line's background lines with it", () => {
		const lyric: TTMLLyric = {
			lyricLines: [
				{ ...newLyricLine(), id: "a" },
				{ ...newLyricLine(), id: "a-bg1", isBG: true },
				{ ...newLyricLine(), id: "a-bg2", isBG: true },
				{ ...newLyricLine(), id: "b" },
				{ ...newLyricLine(), id: "b-bg", isBG: true },
			],
			metadata: [],
		};
		expect(duets(swapDuetLines(lyric, new Set(["a"])))).toEqual([
			true,
			true,
			true,
			false,
			false,
		]);
		// Picking only the background line still moves its lead.
		expect(duets(swapDuetLines(lyric, new Set(["b-bg"])))).toEqual([
			false,
			false,
			false,
			true,
			true,
		]);
	});

	it("treats a background line with no lead as its own group", () => {
		const lyric: TTMLLyric = {
			lyricLines: [
				{ ...newLyricLine(), id: "bg", isBG: true },
				{ ...newLyricLine(), id: "a" },
			],
			metadata: [],
		};
		expect(duets(swapDuetLines(lyric, new Set(["bg"])))).toEqual([true, false]);
	});

	it("returns the same document when no line is in scope", () => {
		const lyric = doc();
		expect(swapDuetLines(lyric, new Set(["missing"]))).toBe(lyric);
		const empty: TTMLLyric = { lyricLines: [], metadata: [] };
		expect(swapDuetLines(empty)).toBe(empty);
	});

	it("leaves the input untouched", () => {
		const lyric = doc();
		swapDuetLines(lyric);
		expect(duets(lyric)).toEqual([false, true, false]);
	});
});

describe("swapDuetLinesAtom", () => {
	it("is undone in one step", () => {
		const store = createStore();
		store.sub(undoableLyricLinesAtom, () => {});
		store.set(lyricLinesAtom, doc());
		store.set(startFreshLyricDocumentAtom);

		store.set(swapDuetLinesAtom);
		expect(duets(store.get(lyricLinesAtom))).toEqual([true, false, true]);

		store.set(undoLyricLinesAtom);
		expect(duets(store.get(lyricLinesAtom))).toEqual([false, true, false]);
		expect(store.get(undoableLyricLinesAtom).canUndo).toBe(false);
	});

	it("adds no history entry when nothing changes", () => {
		const store = createStore();
		store.sub(undoableLyricLinesAtom, () => {});
		store.set(lyricLinesAtom, doc());
		store.set(startFreshLyricDocumentAtom);

		store.set(swapDuetLinesAtom, new Set(["missing"]));
		expect(store.get(undoableLyricLinesAtom).canUndo).toBe(false);
	});
});
