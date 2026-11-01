import { describe, expect, it } from "vitest";
import {
	type LyricLine,
	type LyricSection,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import {
	applySectionTimings,
	findTimingSources,
	moveSectionTo,
	relabelForCategory,
	sectionDropSlot,
	sectionTimingAnchor,
	startSectionAt,
	toHeaderLabel,
	updateSection,
} from "./section-editing";

const section = (
	id: string,
	category: LyricSection["category"],
	label: string,
	ordinal?: number,
): LyricSection => ({ id, category, label, ordinal, confidence: 1 });

/** `text` words separated by spaces; `times` gives [start, end] per word. */
const line = (
	text: string,
	sectionId?: string,
	times?: Array<[number, number]>,
): LyricLine => {
	const words = text.split(" ").map((word, index) => ({
		...newLyricWord(),
		word,
		startTime: times?.[index]?.[0] ?? 0,
		endTime: times?.[index]?.[1] ?? 0,
	}));
	const timed = words.filter((word) => word.endTime > 0);
	return {
		...newLyricLine(),
		sectionId,
		words,
		startTime: timed[0]?.startTime ?? 0,
		endTime: timed[timed.length - 1]?.endTime ?? 0,
	};
};

const lyric = (lines: LyricLine[], sections: LyricSection[]): TTMLLyric => ({
	metadata: [],
	lyricLines: lines,
	sections,
});

const timings = (lyrics: TTMLLyric) =>
	lyrics.lyricLines.map((item) => [
		item.startTime,
		item.endTime,
		...item.words.map((word) => [word.startTime, word.endTime]),
	]);

const sectionIds = (lyrics: TTMLLyric) =>
	lyrics.lyricLines.map((item) => item.sectionId);

describe("relabelForCategory", () => {
	const sections = [
		section("a", "verse", "[Verse 2]", 2),
		section("b", "chorus", "[Chorus 1]", 1),
	];

	it("follows the new category when the label only names the old one", () => {
		expect(relabelForCategory(sections, sections[0], "chorus")).toMatchObject({
			category: "chorus",
			label: "[Chorus 2]",
			ordinal: 2,
		});
	});

	it("keeps hand-written labels", () => {
		const custom = section("c", "verse", "[Verse 1: Guest]", 1);
		expect(relabelForCategory([custom], custom, "bridge")).toMatchObject({
			category: "bridge",
			label: "[Verse 1: Guest]",
		});
		const other = section("d", "other", "[Drop]");
		expect(relabelForCategory([other], other, "hook").label).toBe("[Drop]");
	});
});

describe("startSectionAt", () => {
	it("splits a section at a line and numbers the new one", () => {
		const lyrics = lyric(
			[line("a", "v"), line("b", "v"), line("c", "v"), line("d")],
			[section("v", "verse", "[Verse 1]", 1)],
		);
		const before = timings(lyrics);
		const created = startSectionAt(lyrics, 1, "verse");
		expect(created).toMatchObject({ label: "[Verse 2]", ordinal: 2 });
		expect(sectionIds(lyrics)).toEqual([
			"v",
			created?.id,
			created?.id,
			undefined,
		]);
		expect(lyrics.lyricLines[1].geniusHeader).toBe("[Verse 2]");
		expect(timings(lyrics)).toEqual(before);
	});

	it("covers the rest of an unassigned block", () => {
		const lyrics = lyric(
			[line("a"), line("b"), line("c"), line("d", "c")],
			[section("c", "chorus", "[Chorus 1]", 1)],
		);
		const created = startSectionAt(lyrics, 1, "bridge");
		expect(sectionIds(lyrics)).toEqual([
			undefined,
			created?.id,
			created?.id,
			"c",
		]);
	});

	it("does nothing on a line that already starts a section", () => {
		const lyrics = lyric(
			[line("a", "v"), line("b", "v")],
			[section("v", "verse", "[Verse 1]", 1)],
		);
		expect(startSectionAt(lyrics, 0, "chorus")).toBeUndefined();
		expect(lyrics.sections).toHaveLength(1);
	});
});

describe("updateSection", () => {
	it("stores the label in brackets and updates every line's header", () => {
		const lyrics = lyric(
			[line("a", "v"), line("b", "v"), line("c")],
			[section("v", "verse", "[Verse 1]", 1)],
		);
		expect(updateSection(lyrics, "v", " Chorus 3 ", "chorus")).toBe(true);
		expect(lyrics.sections?.[0]).toMatchObject({
			label: "[Chorus 3]",
			category: "chorus",
			ordinal: 3,
		});
		expect(lyrics.lyricLines.map((item) => item.geniusHeader)).toEqual([
			"[Chorus 3]",
			"[Chorus 3]",
			undefined,
		]);
	});

	it("accepts a typed bracket and ignores an empty label", () => {
		expect(toHeaderLabel("[Hook]")).toBe("[Hook]");
		expect(toHeaderLabel("  ")).toBeUndefined();
		const lyrics = lyric(
			[line("a", "v")],
			[section("v", "verse", "[Verse 1]", 1)],
		);
		expect(updateSection(lyrics, "v", "[]", "hook")).toBe(false);
		expect(lyrics.sections?.[0].label).toBe("[Verse 1]");
	});
});

describe("moving a section by its divider", () => {
	const make = () =>
		lyric(
			[
				line("a", "v"),
				line("b", "v"),
				line("c", "c"),
				line("d", "c"),
				line("e", "c"),
				line("f"),
			],
			[
				section("v", "verse", "[Verse 1]", 1),
				section("c", "chorus", "[Chorus 1]", 1),
			],
		);
	const texts = (lyrics: TTMLLyric) =>
		lyrics.lyricLines.map((item) => item.words[0].word).join("");
	const id = (lyrics: TTMLLyric, text: string) =>
		lyrics.lyricLines.find((item) => item.words[0].word === text)?.id ?? "";

	it("snaps a drop inside another section to its nearer edge", () => {
		const lyrics = make();
		const lines = lyrics.lyricLines;
		expect(sectionDropSlot(lines, "v", id(lyrics, "c"), true)).toEqual({
			lineId: id(lyrics, "c"),
			insertAfter: false,
		});
		expect(sectionDropSlot(lines, "v", id(lyrics, "d"), true)).toEqual({
			lineId: id(lyrics, "e"),
			insertAfter: true,
		});
	});

	it("drops on unassigned lines as is, and never into itself", () => {
		const lyrics = make();
		const lines = lyrics.lyricLines;
		expect(sectionDropSlot(lines, "v", id(lyrics, "f"), true)).toEqual({
			lineId: id(lyrics, "f"),
			insertAfter: true,
		});
		expect(sectionDropSlot(lines, "v", id(lyrics, "b"), true)).toBeUndefined();
	});

	it("moves the whole section, keeping its lines and timings", () => {
		const lyrics = make();
		const before = timings(lyrics);
		const slot = sectionDropSlot(lyrics.lyricLines, "v", id(lyrics, "e"), true);
		expect(slot && moveSectionTo(lyrics, "v", slot)).toBe(true);
		expect(texts(lyrics)).toBe("cdeabf");
		expect(sectionIds(lyrics)).toEqual(["c", "c", "c", "v", "v", undefined]);
		expect(timings(lyrics).sort()).toEqual(before.sort());
	});
});

describe("findTimingSources", () => {
	it("puts repeats first, then similar text, and skips untimed sections", () => {
		const chorus1 = {
			...section("c1", "chorus", "[Chorus 1]", 1),
			repeatGroupId: "g",
		};
		const lyrics = lyric(
			[
				line("hold me now", "c1", [
					[1000, 1200],
					[1200, 1400],
					[1400, 1600],
				]),
				line("something else entirely", "v", [
					[2000, 2100],
					[2100, 2200],
					[2200, 2300],
				]),
				line("hold me now", "u"),
				line("hold me now", "c2"),
			],
			[
				chorus1,
				section("v", "verse", "[Verse 1]", 1),
				section("u", "chorus", "[Chorus 2]", 2),
				{ ...section("c2", "chorus", "[Chorus 3]", 3), repeatGroupId: "g" },
			],
		);
		const sources = findTimingSources(lyrics, "c2");
		expect(sources.map((item) => item.section.id)).toEqual(["c1", "v"]);
		expect(sources[0]).toMatchObject({
			suggested: true,
			sameRepeatGroup: true,
		});
		expect(sources[1].suggested).toBe(false);
	});
});

describe("applySectionTimings", () => {
	const make = () =>
		lyric(
			[
				line("hold me now", "c1", [
					[1000, 1200],
					[1200, 1400],
					[1400, 1600],
				]),
				line("don't let go", "c1", [
					[1700, 1800],
					[1800, 1900],
					[1900, 2400],
				]),
				line("verse line", "v", [
					[3000, 3500],
					[3500, 4000],
				]),
				line("hold me tight", "c2"),
				line("brand new line", "c2"),
				line("don't let go", "c2"),
			],
			[
				section("c1", "chorus", "[Chorus 1]", 1),
				section("v", "verse", "[Verse 1]", 1),
				section("c2", "chorus", "[Chorus 2]", 2),
			],
		);

	it("shifts the source's relative timings to the anchor and copies matching words", () => {
		const lyrics = make();
		const result = applySectionTimings(lyrics, "c2", "c1", 10000);
		expect(result).toEqual({ copiedLines: 2, totalLines: 3, untimedWords: 1 });
		const [held, fresh, letGo] = lyrics.lyricLines.slice(3);
		expect(held.words.map((word) => [word.startTime, word.endTime])).toEqual([
			[10000, 10200],
			[10200, 10400],
			[0, 0],
		]);
		expect([held.startTime, held.endTime]).toEqual([10000, 10600]);
		expect(fresh.words.every((word) => word.startTime === 0)).toBe(true);
		expect(fresh.startTime).toBe(0);
		expect(letGo.words.map((word) => word.startTime)).toEqual([
			10700, 10800, 10900,
		]);
		expect([letGo.startTime, letGo.endTime]).toEqual([10700, 11400]);
	});

	it("keeps the timing of words that don't match", () => {
		const lyrics = make();
		const held = lyrics.lyricLines[3];
		held.words[2].startTime = 10500;
		held.words[2].endTime = 10900;
		const result = applySectionTimings(lyrics, "c2", "c1", 10000);
		expect(result?.untimedWords).toBe(0);
		expect(held.words.map((word) => [word.startTime, word.endTime])).toEqual([
			[10000, 10200],
			[10200, 10400],
			[10500, 10900],
		]);
		expect([held.startTime, held.endTime]).toEqual([10000, 10900]);
	});

	it("leaves the source and other sections alone", () => {
		const lyrics = make();
		const before = timings(lyrics).slice(0, 3);
		applySectionTimings(lyrics, "c2", "c1", 10000);
		expect(timings(lyrics).slice(0, 3)).toEqual(before);
	});

	it("needs a timed source", () => {
		const lyrics = make();
		expect(applySectionTimings(lyrics, "c1", "c2", 0)).toBeUndefined();
	});

	it("anchors on the target's first start time", () => {
		const lyrics = make();
		expect(sectionTimingAnchor(lyrics, "v")).toBe(3000);
		expect(sectionTimingAnchor(lyrics, "c2")).toBeUndefined();
	});

	it("anchors on a first word with only its start marked", () => {
		const lyrics = make();
		const second = lyrics.lyricLines.find(
			(item) => item.sectionId === "c2" && item.words[0].word === "brand",
		);
		if (!second) throw new Error("missing line");
		second.words[0].startTime = 21000;
		expect(sectionTimingAnchor(lyrics, "c2")).toBe(21000);
	});
});
