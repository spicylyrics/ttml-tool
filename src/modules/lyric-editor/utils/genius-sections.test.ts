import { describe, expect, it } from "vitest";
import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml.ts";
import {
	getGeniusHeader,
	getSectionBounds,
	shiftSectionToTime,
} from "./genius-sections.ts";

const line = (
	header: string | undefined,
	startTime = 0,
	words = 1,
	text = "",
): LyricLine => ({
	...newLyricLine(),
	geniusHeader: header,
	startTime,
	endTime: startTime + 100,
	words: Array.from({ length: words }, (_, index) => ({
		...newLyricWord(),
		word: text,
		startTime: startTime + index * 10,
		endTime: startTime + index * 10 + 5,
	})),
});

describe("Genius sections", () => {
	it("recognizes arbitrary bracket-only Genius labels", () => {
		expect(getGeniusHeader(" [Chorus] ")).toBe("[Chorus]");
		expect(getGeniusHeader("[Verse 2: Guest]")).toBe("[Verse 2: Guest]");
		expect(getGeniusHeader("[Post-Chorus]")).toBe("[Post-Chorus]");
		expect(getGeniusHeader("[ ]")).toBe("[ ]");
		expect(getGeniusHeader("[Chorus] lyric")).toBeUndefined();
	});

	it("uses exact labels and contiguous lines as section boundaries", () => {
		const lines = [line("[Chorus]", 100), line("[Chorus]"), line("[Chorus 2]")];
		expect(getSectionBounds(lines, 1)).toMatchObject({ start: 0, end: 2 });
		expect(getSectionBounds(lines, 2)).toMatchObject({ start: 2, end: 3 });
	});

	it("shifts a whole section to a time", () => {
		const lines = [
			line("[Verse]", 400),
			line("[Chorus]", 700, 2, "one"),
			line("[Chorus]", 850, 1, "two"),
		];
		shiftSectionToTime(lines, 1, 900);
		expect(lines[0].startTime).toBe(400);
		expect(lines[1].startTime).toBe(900);
		expect(lines[1].words[1].endTime).toBe(915);
		expect(lines[2].startTime).toBe(1050);
	});

	it("snaps a section without giving untimed words a time", () => {
		const untimed = { ...line("[Verse]", 0), endTime: 0 };
		untimed.words = untimed.words.map((w) => ({
			...w,
			startTime: 0,
			endTime: 0,
		}));
		const lines = [untimed, line("[Verse]", 1000), line("[Verse]", 1200)];

		expect(shiftSectionToTime(lines, 0, 5000)).toBe(true);

		expect([lines[0].startTime, lines[0].endTime]).toEqual([0, 0]);
		expect(lines[0].words[0].startTime).toBe(0);
		expect(lines[1].startTime).toBe(5000);
		expect(lines[2].startTime).toBe(5200);
	});
});
