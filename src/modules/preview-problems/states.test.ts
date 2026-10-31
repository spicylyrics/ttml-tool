import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import {
	collapsedSectionIdsAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	showPreviewPanelAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	jumpToFirstTimingProblemAtom,
	previewTimingProblemsAtom,
} from "./states";

const setup = () => {
	const store = createStore();
	const clean = {
		...newLyricLine(),
		id: "clean",
		startTime: 0,
		endTime: 1000,
		words: [{ ...newLyricWord(), word: "Hi", startTime: 0, endTime: 500 }],
	};
	const early = { ...newLyricWord(), id: "early", word: "you", startTime: 900 };
	early.endTime = 1500;
	const broken = {
		...newLyricLine(),
		id: "broken",
		sectionId: "verse",
		startTime: 1000,
		endTime: 2000,
		words: [early],
	};
	store.set(lyricLinesAtom, {
		lyricLines: [clean, newLyricLine(), broken],
		metadata: [],
	});
	return store;
};

describe("preview timing problems", () => {
	it("lists problems in timed lines", () => {
		const store = setup();
		expect(store.get(previewTimingProblemsAtom)).toEqual([
			{ lineId: "broken", wordId: "early", problems: ["startsBeforeLine"] },
		]);
	});

	it("jumps to the first flagged word in Time mode and keeps the side preview", () => {
		const store = setup();
		store.set(toolModeAtom, ToolMode.Preview);
		store.set(showPreviewPanelAtom, true);
		store.set(collapsedSectionIdsAtom, new Set(["verse", "chorus"]));
		store.set(jumpToFirstTimingProblemAtom);
		expect(store.get(selectedLinesAtom)).toEqual(new Set(["broken"]));
		expect(store.get(selectedWordsAtom)).toEqual(new Set(["early"]));
		expect(store.get(toolModeAtom)).toBe(ToolMode.Sync);
		expect(store.get(showPreviewPanelAtom)).toBe(true);
		expect(store.get(collapsedSectionIdsAtom)).toEqual(new Set(["chorus"]));
	});
});
