import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { buildCueIndex, cueAt } from "./model";

const word = (startTime: number, endTime: number, text = "word") => ({
	...newLyricWord(),
	startTime,
	endTime,
	word: text,
});
const line = (...words: ReturnType<typeof word>[]) => ({
	...newLyricLine(),
	words: words.flatMap((item, index) =>
		index === 0 ? [item] : [{ ...newLyricWord(), word: " " }, item],
	),
});

describe("word timing cue index", () => {
	it("accepts a word at zero, skips invalid/empty/untimed and background or line timings", () => {
		const index = buildCueIndex([
			line(
				word(0, 100),
				word(0, 0),
				word(100, 50),
				word(NaN, 200),
				word(100, 200, " "),
			),
			{ ...line(word(300, 400)), isBG: true },
			{ ...line(word(400, 500)), isLineSynced: true },
			{ ...line(word(500, 600)), ignoreSync: true },
		]);
		expect(index.words).toEqual([
			{
				start: 0,
				end: 100,
				boundaries: [],
				syllables: [{ start: 0, end: 100 }],
			},
		]);
	});
	it("goes dark at the exact end and finds the next word across gaps and seeks", () => {
		const index = buildCueIndex([line(word(300, 400), word(0, 100))]);
		expect(cueAt(index, 50).progress).toBe(0.5);
		expect(cueAt(index, 100)).toMatchObject({
			active: undefined,
			progress: 0,
			next: { start: 300 },
		});
		expect(cueAt(index, 350).progress).toBe(0.5);
		expect(cueAt(index, 10).progress).toBe(0.1);
		expect(cueAt(index, 400)).toMatchObject({
			active: undefined,
			next: undefined,
		});
	});
	it("keeps a long overlapping word active after a later short word finishes", () => {
		const index = buildCueIndex([
			line(word(0, 1000), word(100, 200), word(300, 400)),
		]);
		expect(cueAt(index, 150).active?.start).toBe(100);
		expect(cueAt(index, 250).active?.start).toBe(0);
		expect(cueAt(index, 400).active?.start).toBe(0);
	});
	it("coalesces identical boundaries while preserving simultaneous end and start", () => {
		const index = buildCueIndex([
			line(word(0, 100), word(0, 100), word(100, 200)),
		]);
		expect(index.clicks.word.filter((b) => b.timeMs === 100)).toEqual([
			{ timeMs: 100, kind: "end" },
			{ timeMs: 100, kind: "start" },
		]);
	});
	it("shows duet words and treats background duet lines as background", () => {
		const index = buildCueIndex([
			line(word(0, 100)),
			{ ...line(word(200, 300)), isDuet: true },
			{ ...line(word(400, 500)), isDuet: true, isBG: true },
		]);
		expect(index.words.map((w) => w.start)).toEqual([0, 200]);
		expect(cueAt(index, 250)).toMatchObject({ progress: 0.5 });
		expect(cueAt(index, 150).nextCueTime).toBe(200);
		expect(index.clicks.word).toEqual([
			{ timeMs: 0, kind: "start" },
			{ timeMs: 100, kind: "end" },
			{ timeMs: 200, kind: "start", voice: "duet" },
			{ timeMs: 300, kind: "end", voice: "duet" },
			{ timeMs: 400, kind: "start", voice: "background" },
			{ timeMs: 500, kind: "end", voice: "background" },
		]);
	});
	it("keeps punctuation-only spans in the syllable before them", () => {
		const index = buildCueIndex([
			{
				...newLyricLine(),
				words: [word(0, 100, "hel"), word(100, 200, "lo"), word(200, 300, ",")],
			},
		]);
		expect(index.words[0]).toMatchObject({
			boundaries: [100],
			syllables: [
				{ start: 0, end: 100 },
				{ start: 100, end: 300 },
			],
		});
		expect(index.clicks.syllable.map((b) => b.timeMs)).toEqual([0, 100]);
		expect(cueAt(index, 250, "syllable")).toMatchObject({
			activeSyllable: { start: 100, end: 300 },
			progress: 0.75,
			nextCueTime: undefined,
		});
		expect(cueAt(index, 50, "syllable").nextCueTime).toBe(100);
	});
	it("starts a new syllable after a punctuation-only span", () => {
		const index = buildCueIndex([
			{
				...newLyricLine(),
				words: [
					word(0, 100, "("),
					word(100, 200, "hel"),
					word(200, 210, "-"),
					word(210, 300, "lo"),
				],
			},
		]);
		expect(index.words[0]).toMatchObject({
			boundaries: [210],
			syllables: [
				{ start: 0, end: 210 },
				{ start: 210, end: 300 },
			],
		});
		expect(cueAt(index, 255, "syllable").progress).toBe(0.5);
	});
});
