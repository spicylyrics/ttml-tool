// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";
import { LYRIC_FILE_EXTENSIONS } from "$/utils/lyric-formats";
import { parseLyricFile } from "./lyric-file-open";

// The QRC, YRC and LYS parsers are WASM that is not initialized in tests.
vi.mock("@applemusic-like-lyrics/lyric", () => ({
	parseEslrc: () => [],
	parseLys: () => [],
	parseQrc: () => [],
	parseYrc: () => [],
}));

const TTML = `<tt xmlns="http://www.w3.org/ns/ttml" xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word"><head><metadata/></head><body dur="00:03.000"><div begin="00:00.000" end="00:03.000"><p begin="00:00.000" end="00:03.000"><span begin="00:00.000" end="00:01.000">Hello</span> <span begin="00:01.000" end="00:03.000">world</span></p></div></body></tt>`;

describe("parseLyricFile", () => {
	it("opens a valid TTML", () => {
		const parsed = parseLyricFile(TTML, "ttml");
		expect(parsed.kind).toBe("ok");
		if (parsed.kind === "ok")
			expect(parsed.lyric.lyricLines.length).toBeGreaterThan(0);
	});

	it("refuses broken XML saved as .ttml instead of returning an empty document", () => {
		expect(parseLyricFile("<tt><body", "ttml").kind).toBe("empty");
		expect(parseLyricFile("this is not xml", "ttml").kind).toBe("empty");
	});

	it("refuses a TTML with metadata but no lines", () => {
		const noLines = TTML.replace(/<div.*<\/div>/, "");
		expect(parseLyricFile(noLines, "ttml").kind).toBe("empty");
	});

	it("refuses an LRC with no lines", () => {
		expect(parseLyricFile("", "lrc").kind).toBe("empty");
		expect(parseLyricFile("no timestamps here", "lrc").kind).toBe("empty");
	});

	it("opens an LRC with lines", () => {
		const parsed = parseLyricFile("[00:01.00]hello\n[00:02.00]world", "lrc");
		expect(parsed.kind).toBe("ok");
	});

	it("does not treat other extensions as lyrics", () => {
		expect(parseLyricFile("{}", "json").kind).toBe("unsupported");
		expect(parseLyricFile("x", "constructor").kind).toBe("unsupported");
		expect(LYRIC_FILE_EXTENSIONS.has("json")).toBe(false);
		expect(LYRIC_FILE_EXTENSIONS.has("ttml")).toBe(true);
	});
});
