// @vitest-environment jsdom
import { createStore } from "jotai";
import { describe, expect, it, vi } from "vitest";
import { lyricLinesAtom, newLyricLinesAtom } from "$/states/main";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { autoSaveProject } from "../autosave/autosave";
import { normalizeDocumentWords } from "./normalize-document";
import { parseLyric } from "./ttml-parser";
import exportTTMLText from "./ttml-writer";

const storage = vi.hoisted(() => ({ put: vi.fn(), add: vi.fn() }));
vi.mock("idb", () => ({
	openDB: async () => ({
		transaction: () => ({
			objectStore: () => ({
				...storage,
				index: () => ({
					openCursor: async () => null,
					getAllKeys: async () => [],
				}),
			}),
			done: Promise.resolve(),
		}),
	}),
}));

const legacyDocument = () => ({
	metadata: [{ key: "musicName", value: ["Song"] }],
	marks: [{ timeMs: 1500, label: "cue" }],
	lyricLines: [
		{
			...newLyricLine(),
			startTime: 1000,
			endTime: 3000,
			words: [
				{
					...newLyricWord(),
					word: "漢字",
					startTime: 1000,
					endTime: 3000,
					romanWord: "kanji",
					romanWarning: true,
					ruby: [{ word: "かんじ", startTime: 1200, endTime: 2800 }],
				},
			],
		},
	],
});

function rubyTtml(containerTiming: string, baseTiming = "") {
	return `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:tts="http://www.w3.org/ns/ttml#styling"><head/><body><div><p begin="00:01.000" end="00:04.000"><span tts:ruby="container" ${containerTiming}><span tts:ruby="base" ${baseTiming}>漢字</span><span tts:ruby="textContainer"><span tts:ruby="text" begin="00:01.200" end="00:01.700">かん</span><span tts:ruby="text" begin="00:01.700" end="00:02.800">じ</span></span></span> <span begin="00:03.000" end="00:04.000">next</span></p></div></body></tt>`;
}

describe("ruby import compatibility", () => {
	it.each([
		['begin="00:01.000" end="00:03.000"', 'begin="00:01.100" end="00:02.900"'],
		["", 'begin="00:01.000" end="00:03.000"'],
	])("keeps base text and word timing while dropping timed readings", (containerTiming, baseTiming) => {
		const lyric = parseLyric(rubyTtml(containerTiming, baseTiming));
		expect(lyric.lyricLines[0].words.map((word) => word.word)).toEqual([
			"漢字",
			" ",
			"next",
		]);
		expect(lyric.lyricLines[0].words[0]).toMatchObject({
			startTime: 1000,
			endTime: 3000,
		});
		expect(lyric.lyricLines[0].words[0]).not.toHaveProperty("ruby");
		expect(lyric.lyricLines[0].words[2]).toMatchObject({
			startTime: 3000,
			endTime: 4000,
		});
	});

	it("never writes tts:ruby even when handed a legacy word", () => {
		const xml = exportTTMLText(legacyDocument());
		expect(xml).not.toContain("tts:ruby");
		expect(xml).not.toContain("かんじ");
		expect(parseLyric(xml).lyricLines[0].words[0]).toMatchObject({
			word: "漢字",
			startTime: 1000,
			endTime: 3000,
		});
	});

	it("keeps bases from old exports that timed only the readings", () => {
		const lyric = parseLyric(rubyTtml(""));
		expect(lyric.lyricLines[0].words[0]).toMatchObject({
			word: "漢字",
			startTime: 1000,
			endTime: 4000,
		});
		expect(lyric.lyricLines[0].words[0]).not.toHaveProperty("ruby");
	});
});

describe("legacy project and autosave compatibility", () => {
	it("preserves normalized document containers and only replaces legacy lines", () => {
		const clean = {
			metadata: [],
			lyricLines: [{ ...newLyricLine(), words: [newLyricWord()] }],
		};
		expect(normalizeDocumentWords(clean)).toBe(clean);
		const legacy = legacyDocument();
		const mixed = {
			...legacy,
			lyricLines: [...legacy.lyricLines, clean.lyricLines[0]],
		};
		const normalized = normalizeDocumentWords(mixed);
		expect(normalized.lyricLines[0]).not.toBe(legacy.lyricLines[0]);
		expect(normalized.lyricLines[1]).toBe(clean.lyricLines[0]);
		expect(normalizeDocumentWords(normalized)).toBe(normalized);
	});

	it("loads old words into the editor without retaining ruby or losing supported data", () => {
		const legacy = legacyDocument();
		const before = structuredClone(legacy);
		const store = createStore();
		store.set(newLyricLinesAtom, legacy);
		const loaded = store.get(lyricLinesAtom);
		const { ruby: _reading, ...word } = legacy.lyricLines[0].words[0];
		expect(loaded.lyricLines[0].words[0]).toEqual(word);
		expect(loaded.metadata).toEqual(legacy.metadata);
		expect(loaded.marks).toEqual(legacy.marks);
		expect(legacy).toEqual(before);
		expect(JSON.stringify(loaded)).not.toContain('"ruby"');
	});

	it("omits legacy ruby from new autosave snapshots and history", async () => {
		vi.stubGlobal("IDBKeyRange", { bound: () => ({}) });
		try {
			const legacy = legacyDocument();
			await autoSaveProject("legacy", legacy, 10, 0);
			expect(storage.put).toHaveBeenCalledWith(
				expect.objectContaining({
					latestState: normalizeDocumentWords(legacy),
				}),
			);
			expect(storage.add).toHaveBeenCalledWith(
				expect.objectContaining({ data: normalizeDocumentWords(legacy) }),
			);
			expect(JSON.stringify(storage.put.mock.calls)).not.toContain('"ruby"');
			expect(JSON.stringify(storage.add.mock.calls)).not.toContain('"ruby"');
		} finally {
			vi.unstubAllGlobals();
		}
	});
});
