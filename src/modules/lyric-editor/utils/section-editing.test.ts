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
	moveSectionStart,
	relabelForCategory,
	sectionTimingAnchor,
	startSectionAt,
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

describe("moveSectionStart", () => {
	const make = () =>
		lyric(
			[line("a", "v"), line("b", "v"), line("c", "c"), line("d", "c")],
			[
				section("v", "verse", "[Verse 1]", 1),
				section("c", "chorus", "[Chorus 1]", 1),
			],
		);

	it("takes in the line above and gives the first line back", () => {
		const lyrics = make();
		const before = timings(lyrics);
		expect(moveSectionStart(lyrics, "c", "up")).toBe(true);
		expect(sectionIds(lyrics)).toEqual(["v", "c", "c", "c"]);
		expect(lyrics.lyricLines[1].geniusHeader).toBe("[Chorus 1]");
		expect(moveSectionStart(lyrics, "c", "down")).toBe(true);
		expect(moveSectionStart(lyrics, "c", "down")).toBe(true);
		expect(sectionIds(lyrics)).toEqual(["v", "v", "v", "c"]);
		expect(timings(lyrics)).toEqual(before);
	});

	it("won't empty a section and drops a previous one it swallowed", () => {
		const lyrics = make();
		moveSectionStart(lyrics, "c", "down");
		expect(moveSectionStart(lyrics, "c", "down")).toBe(false);
		const swallow = make();
		moveSectionStart(swallow, "c", "up");
		moveSectionStart(swallow, "c", "up");
		expect(sectionIds(swallow)).toEqual(["c", "c", "c", "c"]);
		expect(swallow.sections?.map((item) => item.id)).toEqual(["c"]);
		expect(moveSectionStart(swallow, "c", "up")).toBe(false);
	});

	it("leaves the first line unassigned when nothing comes before it", () => {
		const lyrics = lyric(
			[line("a"), line("b", "c"), line("c", "c")],
			[section("c", "chorus", "[Chorus 1]", 1)],
		);
		moveSectionStart(lyrics, "c", "down");
		expect(sectionIds(lyrics)).toEqual([undefined, undefined, "c"]);
		expect(lyrics.lyricLines[1].geniusHeader).toBeUndefined();
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

	it("anchors on the target's first timed line", () => {
		const lyrics = make();
		expect(sectionTimingAnchor(lyrics, "v")).toBe(3000);
		expect(sectionTimingAnchor(lyrics, "c2")).toBeUndefined();
	});
});
