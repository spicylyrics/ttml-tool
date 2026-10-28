import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { lyricLinesAtom } from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { processedLyricLinesAtom } from "./segment-processing";

describe("processed line cache", () => {
	it("reuses untouched lines and only processes the edited line", () => {
		const store = createStore();
		const first = {
			...newLyricLine(),
			words: [
				{ ...newLyricWord(), word: "first", startTime: 1000, endTime: 2000 },
			],
		};
		const second = {
			...newLyricLine(),
			startTime: 3000,
			endTime: 4000,
			words: [
				{ ...newLyricWord(), word: "second", startTime: 3000, endTime: 4000 },
			],
		};
		store.set(lyricLinesAtom, { metadata: [], lyricLines: [first, second] });
		const before = store.get(processedLyricLinesAtom);
		store.set(lyricLinesAtom, {
			metadata: [],
			lyricLines: [
				first,
				{
					...second,
					endTime: 4500,
					words: [{ ...second.words[0], endTime: 4500 }],
				},
			],
		});
		const after = store.get(processedLyricLinesAtom);
		expect(after[0]).toBe(before[0]);
		expect(after[0].segments).toBe(before[0].segments);
		expect(after[1]).not.toBe(before[1]);
		expect(after[1].endTime).toBe(4500);
	});
});
