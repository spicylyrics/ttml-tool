import { describe, expect, it } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import {
	applyLineTimingSnapshots,
	createLineTimingSnapshots,
	snapSelectedLineTimingsToTime,
} from "./line-timing";

const line = (text: string, startTime: number, wordCount = 1): LyricLine => ({
	...newLyricLine(),
	startTime,
	endTime: startTime + 100,
	translatedLyric: `${text} translation`,
	sectionId: `${text}-section`,
	words: Array.from({ length: wordCount }, (_, index) => ({
		...newLyricWord(),
		word: `${text}-${index}`,
		startTime: startTime + index * 10,
		endTime: startTime + index * 10 + 5,
	})),
});

describe("line timing transfer", () => {
	it("snapshots non-contiguous selections in document order", () => {
		const lines = [line("first", 100), line("middle", 200), line("last", 300)];
		const snapshots = createLineTimingSnapshots(
			lines,
			new Set([lines[2].id, lines[0].id]),
		);

		expect(snapshots.map(({ sourceLineId }) => sourceLineId)).toEqual([
			lines[0].id,
			lines[2].id,
		]);
	});

	it("copies line and matching word timings without changing content", () => {
		const source = line("source", 100, 2);
		const target = line("target", 900, 2);
		const originalTarget = structuredClone(target);
		const snapshots = createLineTimingSnapshots([source], new Set([source.id]));

		const result = applyLineTimingSnapshots([source, target], 1, snapshots);

		expect(result).toEqual({
			appliedLineCount: 1,
			partial: false,
			wordCountMismatchCount: 0,
		});
		expect(target).toMatchObject({ startTime: 100, endTime: 200 });
		expect(
			target.words.map(({ startTime, endTime }) => [startTime, endTime]),
		).toEqual(
			source.words.map(({ startTime, endTime }) => [startTime, endTime]),
		);
		expect(target.id).toBe(originalTarget.id);
		expect(target.words.map(({ word }) => word)).toEqual(
			originalTarget.words.map(({ word }) => word),
		);
		expect(target.translatedLyric).toBe(originalTarget.translatedLyric);
		expect(target.sectionId).toBe(originalTarget.sectionId);
	});

	it("leaves extra destination words unchanged and reports a mismatch", () => {
		const source = line("source", 100, 1);
		const target = line("target", 900, 2);
		const extraTiming = {
			startTime: target.words[1].startTime,
			endTime: target.words[1].endTime,
		};

		const result = applyLineTimingSnapshots(
			[target],
			0,
			createLineTimingSnapshots([source], new Set([source.id])),
		);

		expect(result.wordCountMismatchCount).toBe(1);
		expect(target.words[1]).toMatchObject(extraTiming);
	});

	it("allows partial transfers at the end of the document", () => {
		const sources = [line("one", 100), line("two", 200), line("three", 300)];
		const targets = [line("before", 700), line("target", 800)];

		const result = applyLineTimingSnapshots(
			targets,
			1,
			createLineTimingSnapshots(sources, new Set(sources.map(({ id }) => id))),
		);

		expect(result).toEqual({
			appliedLineCount: 1,
			partial: true,
			wordCountMismatchCount: 0,
		});
		expect(targets[1]).toMatchObject({ startTime: 100, endTime: 200 });
	});

	it("uses immutable snapshots for overlapping transfers", () => {
		const lines = [line("one", 100), line("two", 200), line("three", 300)];
		const snapshots = createLineTimingSnapshots(
			lines,
			new Set([lines[0].id, lines[1].id]),
		);

		applyLineTimingSnapshots(lines, 1, snapshots);

		expect(lines.map(({ startTime }) => startTime)).toEqual([100, 100, 200]);
	});

	it("snaps selected line and word timings with one shared offset", () => {
		const lines = [line("one", 100, 2), line("skip", 200), line("two", 400, 2)];
		const selected = new Set([lines[0].id, lines[2].id]);

		expect(snapSelectedLineTimingsToTime(lines, selected, 1_000)).toBe(2);
		expect(lines.map(({ startTime }) => startTime)).toEqual([
			1_000, 200, 1_300,
		]);
		expect(lines[0].words[0].startTime).toBe(1_000);
		expect(lines[2].words[1].startTime).toBe(1_310);
	});
});
