import { describe, expect, it } from "vitest";
import { newLyricLine, newLyricWord, type TTMLLyric } from "$/types/ttml";
import {
	applyReviewedSections,
	assignHighConfidenceRepeatGroups,
	collapseKey,
	createSectionsFromSelectedLines,
	duplicateLinesWithSections,
	getOrderedSections,
	insertLinesInSection,
	mergeSectionWithAdjacent,
	mergeUnassignedBlock,
	migrateLegacySections,
	moveSection,
	normalizeSectionHeader,
	removeSectionMetadata,
	repairSectionIntegrity,
	sectionIdAt,
	splitSection,
} from "./section-system";

const line = (text: string, header?: string) => ({
	...newLyricLine(),
	geniusHeader: header,
	words: [{ ...newLyricWord(), word: text }],
});

describe("section header normalization", () => {
	it("preserves labels while extracting aliases, ordinals, and vocalists", () => {
		expect(normalizeSectionHeader("[VERSE II: Guest Artist]")).toMatchObject({
			label: "[VERSE II: Guest Artist]",
			category: "verse",
			ordinal: 2,
			vocalist: "Guest Artist",
			confidence: 1,
		});
		expect(normalizeSectionHeader("[Strofa 3]")).toMatchObject({
			category: "verse",
			ordinal: 3,
		});
	});

	it("preserves unknown labels as other", () => {
		expect(normalizeSectionHeader("[Massive Drop]")).toMatchObject({
			category: "other",
			confidence: 0.35,
		});
	});
});

describe("first-class sections", () => {
	it("migrates contiguous legacy headers and applies reviewed metadata", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [
				line("a", "[Verse 1]"),
				line("b", "[Verse 1]"),
				line("c", "[Chorus]"),
			],
		} as TTMLLyric;

		applyReviewedSections(lyrics, [
			{ occurrence: 0, category: "bridge", confidence: 1 },
		]);

		expect(lyrics.sections).toHaveLength(2);
		expect(lyrics.lyricLines[0].sectionId).toBe(lyrics.lyricLines[1].sectionId);
		expect(lyrics.lyricLines[2].sectionId).not.toBe(
			lyrics.lyricLines[0].sectionId,
		);
		expect(lyrics.sections?.[0]).toMatchObject({
			category: "bridge",
			confidence: 1,
		});
	});

	it("automatically links only high-confidence repeats", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [
				line("same chorus", "[Chorus]"),
				line("verse", "[Verse]"),
				line("same chorus", "[Chorus]"),
			],
		} as TTMLLyric;
		migrateLegacySections(lyrics);
		assignHighConfidenceRepeatGroups(lyrics);
		expect(lyrics.sections?.[0].repeatGroupId).toBeTruthy();
		expect(lyrics.sections?.[2].repeatGroupId).toBe(
			lyrics.sections?.[0].repeatGroupId,
		);
		expect(lyrics.sections?.[1].repeatGroupId).toBeUndefined();
	});

	it("supports split, merge, move, and metadata removal", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [
				line("a", "[Verse]"),
				line("b", "[Verse]"),
				line("c", "[Chorus]"),
			],
		} as TTMLLyric;
		migrateLegacySections(lyrics);
		const verseId = lyrics.sections?.[0].id ?? "";
		const chorusId = lyrics.sections?.[1].id ?? "";

		const split = splitSection(lyrics, verseId, 1);
		expect(split).toBeTruthy();
		expect(moveSection(lyrics, chorusId, "up")).toBe(true);
		expect(mergeSectionWithAdjacent(lyrics, chorusId, "next")).toBe(true);
		removeSectionMetadata(lyrics, chorusId);
		expect(lyrics.lyricLines.some((item) => item.sectionId === chorusId)).toBe(
			false,
		);
	});

	it("uses lyric order for navigation and safely rejects missing neighbors", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [line("verse", "[Verse]"), line("chorus", "[Chorus]")],
		} as TTMLLyric;
		migrateLegacySections(lyrics);
		const verseId = lyrics.lyricLines[0].sectionId ?? "";
		const chorusId = lyrics.lyricLines[1].sectionId ?? "";

		expect(moveSection(lyrics, verseId, "up")).toBe(false);
		expect(moveSection(lyrics, chorusId, "down")).toBe(false);
		expect(mergeSectionWithAdjacent(lyrics, verseId, "previous")).toBe(false);
		expect(mergeSectionWithAdjacent(lyrics, chorusId, "next")).toBe(false);

		expect(moveSection(lyrics, chorusId, "up")).toBe(true);
		expect(getOrderedSections(lyrics).map((section) => section.id)).toEqual([
			chorusId,
			verseId,
		]);
	});

	it("creates separately numbered sections for non-contiguous selected lines", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [line("a"), line("b"), line("c"), line("d")],
		} as TTMLLyric;
		const selected = new Set([
			lyrics.lyricLines[0].id,
			lyrics.lyricLines[2].id,
			lyrics.lyricLines[3].id,
		]);

		const sections = createSectionsFromSelectedLines(lyrics, selected, "verse");

		expect(sections.map((section) => section.label)).toEqual([
			"[Verse 1]",
			"[Verse 2]",
		]);
		expect(lyrics.lyricLines.map((item) => item.sectionId)).toEqual([
			sections[0].id,
			undefined,
			sections[1].id,
			sections[1].id,
		]);
	});

	it("does not overwrite selected lines that already belong to a section", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [line("a", "[Verse 1]"), line("b")],
		} as TTMLLyric;
		migrateLegacySections(lyrics);

		expect(
			createSectionsFromSelectedLines(
				lyrics,
				new Set(lyrics.lyricLines.map((item) => item.id)),
				"chorus",
			),
		).toEqual([]);
		expect(lyrics.sections).toHaveLength(1);
	});

	it("duplicates categorized lines into a new repeat-linked section", () => {
		const lyrics = {
			metadata: [],
			lyricLines: [line("a", "[Verse]"), line("b", "[Verse]")],
		} as TTMLLyric;
		migrateLegacySections(lyrics);
		const sourceId = lyrics.lyricLines[0].sectionId ?? "";
		const copies = duplicateLinesWithSections(
			lyrics,
			new Set(lyrics.lyricLines.map((item) => item.id)),
		);
		lyrics.lyricLines.push(...copies);
		repairSectionIntegrity(lyrics);
		expect(lyrics.sections).toHaveLength(2);
		expect(copies[0].sectionId).not.toBe(sourceId);
		expect(lyrics.sections?.[0].repeatGroupId).toBeTruthy();
		expect(lyrics.sections?.[1].repeatGroupId).toBe(
			lyrics.sections?.[0].repeatGroupId,
		);
		const ids = lyrics.lyricLines.map((item) => item.sectionId);
		for (const section of lyrics.sections ?? []) {
			const run = ids.slice(
				ids.indexOf(section.id),
				ids.lastIndexOf(section.id) + 1,
			);
			expect(run.every((id) => id === section.id)).toBe(true);
		}
	});

	it("repairs non-contiguous section ids and merges unassigned blocks", () => {
		const lyrics = {
			metadata: [],
			sections: [{ id: "verse", label: "[Verse]", category: "verse" }],
			lyricLines: [
				{ ...line("a"), sectionId: "verse" },
				line("gap"),
				{ ...line("b"), sectionId: "verse" },
			],
		} as TTMLLyric;
		repairSectionIntegrity(lyrics);
		expect(lyrics.lyricLines[2].sectionId).not.toBe("verse");
		expect(mergeUnassignedBlock(lyrics, 1, "previous")).toBe(true);
		expect(lyrics.lyricLines[1].sectionId).toBe("verse");
	});
});

// Discord report: inserting, pasting and deleting lines inside a Genius
// section split it into extra headers.
describe("editing lines inside a section", () => {
	const song = () => {
		const lyrics = {
			metadata: [],
			lyricLines: [
				line("a", "[Verse 1]"),
				line("b", "[Verse 1]"),
				line("c", "[Verse 1]"),
				line("d", "[Chorus]"),
			],
		} as TTMLLyric;
		migrateLegacySections(lyrics);
		return lyrics;
	};
	const headers = (lyrics: TTMLLyric) =>
		lyrics.lyricLines.flatMap((item, index) =>
			index === 0 || item.sectionId !== lyrics.lyricLines[index - 1].sectionId
				? [item.geniusHeader]
				: [],
		);

	it("finds the section only strictly inside it", () => {
		const lyrics = song();
		const verseId = lyrics.lyricLines[0].sectionId;
		expect(sectionIdAt(lyrics.lyricLines, 1)).toBe(verseId);
		expect(sectionIdAt(lyrics.lyricLines, 0)).toBeUndefined();
		expect(sectionIdAt(lyrics.lyricLines, 3)).toBeUndefined();
		expect(sectionIdAt(lyrics.lyricLines, 4)).toBeUndefined();
	});

	it("keeps a new line inserted inside a section in that section", () => {
		const lyrics = song();
		const verseId = sectionIdAt(lyrics.lyricLines, 2);
		insertLinesInSection(lyrics, 2, [newLyricLine()], verseId);
		expect(lyrics.lyricLines[2].sectionId).toBe(verseId);
		expect(lyrics.lyricLines[2].geniusHeader).toBe("[Verse 1]");
		expect(headers(lyrics)).toEqual(["[Verse 1]", "[Chorus]"]);
	});

	it("pastes a copy into the same section without a new header", () => {
		const lyrics = song();
		const verseId = sectionIdAt(lyrics.lyricLines, 2);
		const copies = duplicateLinesWithSections(
			lyrics,
			new Set([lyrics.lyricLines[0].id]),
			verseId,
		);
		insertLinesInSection(lyrics, 2, copies, verseId);
		expect(lyrics.sections).toHaveLength(2);
		expect(lyrics.sections?.[0].repeatGroupId).toBeUndefined();
		expect(headers(lyrics)).toEqual(["[Verse 1]", "[Chorus]"]);

		// Deleting the pasted line leaves the verse whole.
		lyrics.lyricLines.splice(2, 1);
		repairSectionIntegrity(lyrics);
		expect(headers(lyrics)).toEqual(["[Verse 1]", "[Chorus]"]);
	});

	it("still repeats a section when its lines are pasted outside it", () => {
		const lyrics = song();
		const copies = duplicateLinesWithSections(
			lyrics,
			new Set([lyrics.lyricLines[0].id]),
			sectionIdAt(lyrics.lyricLines, 4),
		);
		insertLinesInSection(lyrics, 4, copies, undefined);
		expect(headers(lyrics)).toEqual(["[Verse 1]", "[Chorus]", "[Verse 1]"]);
		expect(lyrics.sections?.[2].repeatGroupId).toBe(
			lyrics.sections?.[0].repeatGroupId,
		);
	});

	it("leaves a line inserted between two sections unassigned", () => {
		const lyrics = song();
		insertLinesInSection(
			lyrics,
			3,
			[newLyricLine()],
			sectionIdAt(lyrics.lyricLines, 3),
		);
		expect(lyrics.lyricLines[3].sectionId).toBeUndefined();
		expect(lyrics.sections).toHaveLength(2);
	});
});

describe("collapseKey", () => {
	it("keys a line by its section, or by the first line of its unsectioned stretch", () => {
		const lines = [
			{ id: "a", sectionId: "verse" },
			{ id: "b" },
			{ id: "c" },
			{ id: "d", sectionId: "chorus" },
			{ id: "e" },
		];
		expect(lines.map((_, index) => collapseKey(lines, index))).toEqual([
			"verse",
			"unsectioned:b",
			"unsectioned:b",
			"chorus",
			"unsectioned:e",
		]);
		expect(collapseKey(lines, 9)).toBeUndefined();
	});
});
