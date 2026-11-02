import { createStore } from "jotai";
import { describe, expect, it } from "vitest";
import { lyricLinesAtom } from "$/states/main.ts";
import { newLyricLine } from "$/types/ttml.ts";
import { activeLineIdsAtom, currentTimeAtom } from "./index.ts";

describe("activeLineIdsAtom", () => {
	it("skips untimed lines at 0:00 and keeps timed ones", () => {
		const store = createStore();
		const untimed = newLyricLine();
		const timed = { ...newLyricLine(), startTime: 0, endTime: 2000 };
		store.set(lyricLinesAtom, {
			metadata: [],
			lyricLines: [untimed, timed],
		});
		store.set(currentTimeAtom, 0);
		expect(store.get(activeLineIdsAtom)).toEqual([timed.id]);
	});
});
