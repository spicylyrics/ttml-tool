import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { currentTimeAtom } from "$/modules/audio/states";
import type { SegmentationConfig } from "$/modules/segmentation/types";
import { recalculateWordTime } from "$/modules/segmentation/utils/segmentation";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	ToolMode,
	toolModeAtom,
} from "$/states/main";
import { type LyricWord, newLyricLine, newLyricWord } from "$/types/ttml";
import { applyPlayheadSplit } from "./split-timing";
import { timeModeWordEditingEnabledAtom } from "./states";
import { createTimeModeSplit } from "./time-mode-split";

const word = (text: string, startTime: number, endTime: number): LyricWord => ({
	...newLyricWord(),
	word: text,
	startTime,
	endTime,
});

const times = (words: LyricWord[]) =>
	words.map((w) => [w.word, w.startTime, w.endTime]);

// The Split word dialog's own proportional split (weights by letters).
const proportional = (original: LyricWord, segments: string[]) =>
	recalculateWordTime(original, segments, {
		punctuationWeight: 0.2,
	} as SegmentationConfig);

describe("applyPlayheadSplit", () => {
	const original = word("hello", 1000, 2000);
	const parts = [word("hel", 1000, 1600), word("lo", 1600, 2000)];

	it("splits a two-part word at the playhead when it is inside the word", () => {
		expect(times(applyPlayheadSplit(original, parts, 1250))).toEqual([
			["hel", 1000, 1250],
			["lo", 1250, 2000],
		]);
	});

	it("rounds the playhead to whole milliseconds", () => {
		expect(applyPlayheadSplit(original, parts, 1250.6)[0].endTime).toBe(1251);
	});

	it("keeps the proportional split when the playhead is outside or on an edge", () => {
		for (const playhead of [500, 1000, 2000, 2500, null, Number.NaN]) {
			expect(applyPlayheadSplit(original, parts, playhead)).toBe(parts);
		}
	});

	it("keeps the proportional split for three or more parts", () => {
		const three = [
			word("h", 1000, 1200),
			word("el", 1200, 1600),
			word("lo", 1600, 2000),
		];
		expect(applyPlayheadSplit(original, three, 1500)).toBe(three);
	});

	it("leaves untimed words alone", () => {
		const untimed = word("hello", 0, 0);
		const split = [word("hel", 0, 0), word("lo", 0, 0)];
		expect(applyPlayheadSplit(untimed, split, 0)).toBe(split);
	});

	it("does not mutate its inputs", () => {
		const before = times(parts);
		applyPlayheadSplit(original, parts, 1250);
		expect(times(parts)).toEqual(before);
	});
});

describe("createTimeModeSplit", () => {
	function setup({ enabled, mode }: { enabled: boolean; mode: ToolMode }) {
		const store = createStore();
		const target = word("hello", 1000, 2000);
		const other = word("hello", 3000, 4000);
		const line = { ...newLyricLine(), words: [target, other] };
		store.set(lyricLinesAtom, { metadata: [], lyricLines: [line] });
		store.set(timeModeWordEditingEnabledAtom, enabled);
		store.set(toolModeAtom, mode);
		store.set(currentTimeAtom, 1250);
		store.set(selectedLinesAtom, new Set([line.id]));
		store.set(selectedWordsAtom, new Set([target.id]));
		return { store, target, other, line };
	}

	it("is off unless the flag is on and the editor is in Time mode", () => {
		expect(
			createTimeModeSplit(
				setup({ enabled: false, mode: ToolMode.Sync }).store,
				{ lineIndex: 0, wordIndex: 0 },
			),
		).toBeNull();
		expect(
			createTimeModeSplit(setup({ enabled: true, mode: ToolMode.Edit }).store, {
				lineIndex: 0,
				wordIndex: 0,
			}),
		).toBeNull();
	});

	it("splits only the dialog's target at the playhead and selects its first part", () => {
		const { store, target, other, line } = setup({
			enabled: true,
			mode: ToolMode.Sync,
		});
		const split = createTimeModeSplit(store, { lineIndex: 0, wordIndex: 0 });
		if (!split) throw new Error("expected a Time-mode split");

		const targetParts = split.adjust(
			target,
			proportional(target, ["hel", "lo"]),
		);
		expect(times(targetParts)).toEqual([
			["hel", 1000, 1250],
			["lo", 1250, 2000],
		]);

		// "Apply to all identical words" keeps other matches proportional.
		const otherParts = proportional(other, ["hel", "lo"]);
		expect(split.adjust(other, otherParts)).toBe(otherParts);

		split.reselect();
		expect(store.get(selectedLinesAtom)).toEqual(new Set([line.id]));
		expect(store.get(selectedWordsAtom)).toEqual(new Set([targetParts[0].id]));
	});
});
