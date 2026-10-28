import { describe, expect, it } from "vitest";
import {
	type LyricLine,
	type LyricSection,
	newLyricLine,
	newLyricWord,
} from "$/types/ttml";
import {
	linesToTranscript,
	parseTranscript,
	toGeniusText,
	toPlainText,
	transcriptStats,
} from "./transcript-export";

const messy = [
	"",
	"[Verse 1]",
	"",
	"  First line   ",
	"Second line",
	"",
	"",
	"",
	"[Chorus]",
	"Hook line (ooh)",
	"[Verse 2]",
	"Third line",
	"",
].join("\r\n");

describe("parseTranscript", () => {
	it("splits stanzas on headers and blank rows", () => {
		expect(parseTranscript(messy)).toEqual([
			{ header: "[Verse 1]", lines: ["First line", "Second line"] },
			{ header: "[Chorus]", lines: ["Hook line (ooh)"] },
			{ header: "[Verse 2]", lines: ["Third line"] },
		]);
	});

	it("keeps headerless stanzas and lone headers", () => {
		expect(parseTranscript("a\nb\n\nc\n[Outro]")).toEqual([
			{ lines: ["a", "b"] },
			{ lines: ["c"] },
			{ header: "[Outro]", lines: [] },
		]);
	});
});

describe("toGeniusText", () => {
	it("puts one blank row between stanzas and none inside", () => {
		expect(toGeniusText(messy)).toBe(
			[
				"[Verse 1]",
				"First line",
				"Second line",
				"",
				"[Chorus]",
				"Hook line (ooh)",
				"",
				"[Verse 2]",
				"Third line",
			].join("\n"),
		);
	});

	it("leaves words, case and punctuation as typed", () => {
		expect(toGeniusText("i don't know, OK?")).toBe("i don't know, OK?");
	});

	it("is stable when run twice", () => {
		const once = toGeniusText(messy);
		expect(toGeniusText(once)).toBe(once);
	});

	it("returns an empty string for an empty transcript", () => {
		expect(toGeniusText("\n \n")).toBe("");
	});
});

describe("toPlainText", () => {
	it("drops headers and keeps stanza breaks", () => {
		expect(toPlainText(messy)).toBe(
			[
				"First line",
				"Second line",
				"",
				"Hook line (ooh)",
				"",
				"Third line",
			].join("\n"),
		);
	});

	it("drops a stanza that is only a header", () => {
		expect(toPlainText("[Intro]\n[Verse]\nline")).toBe("line");
	});
});

const line = (text: string, extra: Partial<LyricLine> = {}): LyricLine => ({
	...newLyricLine(),
	words: text.split(/(?<= )/).map((word) => ({ ...newLyricWord(), word })),
	...extra,
});

describe("linesToTranscript", () => {
	const sections: LyricSection[] = [
		{ id: "v", label: "[Verse 1]", category: "verse", ordinal: 1 },
		{ id: "c", label: "[Chorus]", category: "chorus" },
	];

	it("writes headers and folds background lines into parentheses", () => {
		const text = linesToTranscript(
			[
				line("Hello there ", { sectionId: "v" }),
				line("hey", { sectionId: "v", isBG: true }),
				line("Second", { sectionId: "v" }),
				line("Sing it", { sectionId: "c" }),
				line("(oh)", { sectionId: "c", isBG: true }),
			],
			sections,
		);
		expect(text).toBe(
			[
				"[Verse 1]",
				"Hello there (hey)",
				"Second",
				"",
				"[Chorus]",
				"Sing it (oh)",
			].join("\n"),
		);
		expect(toPlainText(text)).toBe("Hello there (hey)\nSecond\n\nSing it (oh)");
	});

	it("works without sections", () => {
		expect(linesToTranscript([line("a b"), line("c")])).toBe("a b\nc");
	});
});

describe("transcriptStats", () => {
	it("counts lyric rows and words, not headers", () => {
		expect(transcriptStats(messy)).toEqual({ lines: 4, words: 9 });
		expect(transcriptStats("")).toEqual({ lines: 0, words: 0 });
	});
});
