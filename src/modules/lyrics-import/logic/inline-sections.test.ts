import { describe, expect, it } from "vitest";
import { detectSections } from "./import-text";
import {
	listInlineSections,
	mergeInlineSectionUp,
	renameInlineSection,
	retypeInlineSection,
} from "./inline-sections";

const TEXT = [
	"[Intro]",
	"Oh",
	"",
	"[Verse 2: Singer]",
	"First line",
	"Second line",
	"[Mystery thing]",
	"Third line",
].join("\n");

describe("listInlineSections", () => {
	it("lists each header with its row, category and lines", () => {
		expect(listInlineSections(TEXT)).toEqual([
			{
				lineIndex: 0,
				text: "Intro",
				category: "intro",
				confidence: 1,
				lineCount: 1,
				firstLine: "Oh",
			},
			{
				lineIndex: 3,
				text: "Verse 2: Singer",
				category: "verse",
				confidence: 1,
				lineCount: 2,
				firstLine: "First line",
			},
			{
				lineIndex: 6,
				text: "Mystery thing",
				category: "other",
				confidence: 0.35,
				lineCount: 1,
				firstLine: "Third line",
			},
		]);
	});

	it("agrees with what the import creates", () => {
		const text = `${TEXT}\r\n  [Chorus]  \r\nLa la\n[]\nnot a header`;
		const inline = listInlineSections(text);
		const imported = detectSections(text);
		expect(inline.map((section) => section.category)).toEqual(
			imported.map((section) => section.category),
		);
		expect(inline.map((section) => section.lineCount)).toEqual(
			imported.map((section) => section.lineCount),
		);
	});

	it("is empty without headers", () => {
		expect(listInlineSections("Just\nlyrics")).toEqual([]);
	});
});

describe("renameInlineSection", () => {
	it("rewrites the header row and round-trips into the list", () => {
		const next = renameInlineSection(TEXT, 6, "Bridge: Both");
		expect(next.split("\n")[6]).toBe("[Bridge: Both]");
		expect(listInlineSections(next)[2]).toMatchObject({
			text: "Bridge: Both",
			category: "bridge",
		});
	});

	it("keeps the indent and drops brackets", () => {
		const next = renameInlineSection("  [Hook]\nLa", 0, " [Chorus] ");
		expect(next).toBe("  [Chorus]\nLa");
	});

	it("ignores empty names and rows that aren't headers", () => {
		expect(renameInlineSection(TEXT, 0, "  ")).toBe(TEXT);
		expect(renameInlineSection(TEXT, 1, "Chorus")).toBe(TEXT);
		expect(renameInlineSection(TEXT, 99, "Chorus")).toBe(TEXT);
	});
});

describe("retypeInlineSection", () => {
	it("changes the category and keeps number and vocalist", () => {
		const next = retypeInlineSection(TEXT, 3, "pre-chorus");
		expect(next.split("\n")[3]).toBe("[Pre-Chorus 2: Singer]");
		expect(listInlineSections(next)[1]).toMatchObject({
			category: "pre-chorus",
			confidence: 1,
		});
	});

	it("round-trips every category", () => {
		for (const category of [
			"intro",
			"verse",
			"pre-chorus",
			"chorus",
			"post-chorus",
			"refrain",
			"hook",
			"bridge",
			"break",
			"interlude",
			"instrumental",
			"solo",
			"spoken",
			"skit",
			"sample",
			"outro",
			"other",
		] as const) {
			const next = retypeInlineSection(TEXT, 6, category);
			expect(listInlineSections(next)[2].category).toBe(category);
		}
	});

	it("leaves the rest of the text alone", () => {
		const next = retypeInlineSection(TEXT, 0, "outro");
		expect(next.split("\n").slice(1)).toEqual(TEXT.split("\n").slice(1));
	});
});

describe("mergeInlineSectionUp", () => {
	it("removes the header so its lines join the section before", () => {
		const next = mergeInlineSectionUp(TEXT, 6);
		const sections = listInlineSections(next);
		expect(sections).toHaveLength(2);
		expect(sections[1]).toMatchObject({
			text: "Verse 2: Singer",
			lineCount: 3,
		});
		expect(detectSections(next)).toHaveLength(2);
	});

	it("keeps the first section and non-header rows", () => {
		expect(mergeInlineSectionUp(TEXT, 0)).toBe(TEXT);
		expect(mergeInlineSectionUp(TEXT, 1)).toBe(TEXT);
	});
});
