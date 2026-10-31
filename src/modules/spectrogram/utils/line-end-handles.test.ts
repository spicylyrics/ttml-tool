import { describe, expect, it } from "vitest";
import { processSingleLine } from "$/modules/segmentation/utils/segment-processing";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import {
	getMergedHitZone,
	getSplitHitZones,
	getUpdatedLineForMergedEnd,
	LINE_END_MERGE_TOLERANCE_MS,
	resolveLineEndHandles,
} from "./line-end-handles";

const makeLine = (
	endTime: number,
	words: [string, number, number][] = [
		["a", 100, 500],
		["b", 500, 900],
	],
) =>
	processSingleLine({
		...newLyricLine(),
		id: "line",
		startTime: 100,
		endTime,
		words: words.map(([id, startTime, endTime]) => ({
			...newLyricWord(),
			id,
			word: id,
			startTime,
			endTime,
		})),
	});

const resolve = (line: ReturnType<typeof makeLine>) =>
	resolveLineEndHandles(line.segments, line.endTime);

describe("resolveLineEndHandles", () => {
	it("merges when the last word ends exactly at the line end", () => {
		expect(resolve(makeLine(900))).toEqual({
			kind: "merged",
			wordIndex: 1,
			gapIndex: null,
		});
	});

	it("merges a trailing gap within the tolerance", () => {
		expect(resolve(makeLine(900 + LINE_END_MERGE_TOLERANCE_MS))).toEqual({
			kind: "merged",
			wordIndex: 1,
			gapIndex: 2,
		});
	});

	it("splits a trailing gap past the tolerance", () => {
		expect(resolve(makeLine(901 + LINE_END_MERGE_TOLERANCE_MS))).toEqual({
			kind: "split",
			wordIndex: 1,
			gapIndex: 2,
		});
	});

	it("leaves lines without words to the classic dividers", () => {
		expect(resolve(makeLine(900, []))).toEqual({ kind: "none" });
	});

	it("merges when the last word runs past the stored line end", () => {
		// Processing widens the line to cover its words, so they end together.
		expect(resolve(makeLine(800))).toEqual({
			kind: "merged",
			wordIndex: 1,
			gapIndex: null,
		});
	});

	it("leaves a nested last word to the classic dividers", () => {
		const nested = makeLine(910, [
			["a", 100, 900],
			["b", 300, 400],
		]);
		expect(resolve(nested)).toEqual({ kind: "none" });
	});
});

describe("getUpdatedLineForMergedEnd", () => {
	it("moves the word end and the line end together", () => {
		const updated = getUpdatedLineForMergedEnd(makeLine(900), 1200);
		expect(updated.endTime).toBe(1200);
		expect(updated.segments[1]).toMatchObject({ id: "b", endTime: 1200 });
		expect(updated.segments).toHaveLength(2);
	});

	it("closes a tiny trailing gap", () => {
		const updated = getUpdatedLineForMergedEnd(makeLine(910), 800);
		expect(updated.endTime).toBe(800);
		expect(updated.segments.map((s) => s.type)).toEqual(["word", "word"]);
		expect(updated.segments[1].endTime).toBe(800);
	});

	it("keeps the last word at least 10 ms long", () => {
		const updated = getUpdatedLineForMergedEnd(makeLine(900), 0);
		expect(updated.segments[1].endTime).toBe(510);
		expect(updated.endTime).toBe(510);
	});

	it("moves only the line end when Alt-dragged right", () => {
		const updated = getUpdatedLineForMergedEnd(makeLine(900), 1100, true);
		expect(updated.endTime).toBe(1100);
		expect(updated.segments[1].endTime).toBe(900);
		expect(updated.segments[2]).toMatchObject({
			type: "gap",
			startTime: 900,
			endTime: 1100,
		});
	});

	it("moves only the word end when Alt-dragged left", () => {
		const updated = getUpdatedLineForMergedEnd(makeLine(900), 700, true);
		expect(updated.endTime).toBe(900);
		expect(updated.segments[1].endTime).toBe(700);
		expect(updated.segments[2]).toMatchObject({
			type: "gap",
			startTime: 700,
			endTime: 900,
		});
	});

	it("returns split lines unchanged", () => {
		const split = makeLine(1500);
		expect(getUpdatedLineForMergedEnd(split, 1000)).toBe(split);
	});
});

describe("hit zones", () => {
	it("gives each split handle the full wide zone when they are far apart", () => {
		expect(getSplitHitZones(100, false, 20)).toEqual({
			word: { offsetPx: -10, widthPx: 20 },
			line: { offsetPx: -10, widthPx: 20 },
		});
	});

	it("cuts close split zones at the midpoint so they never overlap", () => {
		const { word, line } = getSplitHitZones(8, false, 20);
		expect(word).toEqual({ offsetPx: -10, widthPx: 14 });
		expect(line).toEqual({ offsetPx: -4, widthPx: 14 });
		// word zone ends at +4 from the word end, line zone starts at 8 - 4.
		expect(word.offsetPx + word.widthPx).toBe(8 + line.offsetPx);
	});

	it("keeps a touching line end's zone inside its own line", () => {
		const { line } = getSplitHitZones(100, true, 20);
		expect(line.offsetPx + line.widthPx).toBe(0);
		expect(line.widthPx).toBe(20);
	});

	it("centers a free merged zone and keeps a touching one inside the line", () => {
		expect(getMergedHitZone(false, 20)).toEqual({ offsetPx: -10, widthPx: 20 });
		expect(getMergedHitZone(true, 20)).toEqual({ offsetPx: -20, widthPx: 20 });
	});
});
