import { describe, expect, it } from "vitest";
import { newLyricLine, type TTMLLyric } from "$/types/ttml";
import { parseDurationInput, scaleTTMLTimings } from "./time-stretch";

describe("parseDurationInput", () => {
	it("accepts seconds and timestamp formats", () => {
		expect(parseDurationInput("210.5")).toBe(210_500);
		expect(parseDurationInput("03:30.500")).toBe(210_500);
		expect(parseDurationInput("1:02:03.004")).toBe(3_723_004);
		expect(parseDurationInput(" 01:00 ")).toBe(60_000);
	});

	it("handles zero and rejects invalid values", () => {
		expect(parseDurationInput("0")).toBe(0);
		expect(parseDurationInput("-1")).toBeNull();
		expect(parseDurationInput("not a duration")).toBeNull();
		expect(parseDurationInput("")).toBeNull();
	});
});

describe("scaleTTMLTimings", () => {
	it("scales every stored timeline timestamp and preserves other data", () => {
		const lyrics: TTMLLyric = {
			metadata: [{ key: "ttml:language", value: ["en"] }],
			marks: [{ timeMs: 501, label: "Verse" }],
			lyricLines: [
				{
					id: "line-1",
					startTime: 1_001,
					endTime: 2_001,
					ignoreSync: false,
					isBG: false,
					isDuet: false,
					translatedLyric: "",
					romanLyric: "",
					words: [
						{
							id: "word-1",
							word: "hello",
							startTime: 1_101,
							endTime: 1_901,
							obscene: false,
							romanWord: "",
						},
					],
				},
			],
		};

		scaleTTMLTimings(lyrics, 0.5);

		expect(lyrics.lyricLines[0].startTime).toBe(501);
		expect(lyrics.lyricLines[0].endTime).toBe(1_001);
		expect(lyrics.lyricLines[0].words[0].startTime).toBe(551);
		expect(lyrics.lyricLines[0].words[0].endTime).toBe(951);
		expect(lyrics.marks?.[0]).toEqual({ timeMs: 251, label: "Verse" });
		expect(lyrics.metadata).toEqual([{ key: "ttml:language", value: ["en"] }]);
	});

	it("keeps a zero start at zero", () => {
		const lyrics: TTMLLyric = {
			metadata: [],
			lyricLines: [
				{
					id: "line-1",
					startTime: 0,
					endTime: 100,
					ignoreSync: false,
					isBG: false,
					isDuet: false,
					translatedLyric: "",
					romanLyric: "",
					words: [],
				},
			],
		};

		scaleTTMLTimings(lyrics, 2);

		expect(lyrics.lyricLines[0].startTime).toBe(0);
		expect(lyrics.lyricLines[0].endTime).toBe(200);
	});

	it("scales only the requested lines and leaves marks unchanged", () => {
		const lyrics: TTMLLyric = {
			metadata: [],
			marks: [{ timeMs: 100, label: "Verse" }],
			lyricLines: [
				{ ...newLyricLine(), startTime: 100, endTime: 200, words: [] },
				{ ...newLyricLine(), startTime: 300, endTime: 400, words: [] },
			],
		};

		scaleTTMLTimings(lyrics, 2, new Set([1]));

		expect(lyrics.lyricLines[0]).toMatchObject({
			startTime: 100,
			endTime: 200,
		});
		expect(lyrics.lyricLines[1]).toMatchObject({
			startTime: 600,
			endTime: 800,
		});
		expect(lyrics.marks?.[0]).toEqual({ timeMs: 100, label: "Verse" });
	});

	it("rejects invalid scale factors", () => {
		const lyrics: TTMLLyric = { metadata: [], lyricLines: [] };
		expect(() => scaleTTMLTimings(lyrics, 0)).toThrow(RangeError);
		expect(() => scaleTTMLTimings(lyrics, Number.POSITIVE_INFINITY)).toThrow(
			RangeError,
		);
	});
});
