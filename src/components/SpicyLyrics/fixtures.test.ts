// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import { findSpicyBlurAnchor, findSpicyScrollIndex } from "./active-line";
import bgAtEnd from "./fixtures/bg-at-end.ttml?raw";
import bgBeforeMain from "./fixtures/bg-before-main.ttml?raw";
import consecutiveBg from "./fixtures/consecutive-bg.ttml?raw";
import fastRap from "./fixtures/fast-rap.ttml?raw";
import hyphens from "./fixtures/hyphens.ttml?raw";
import splitSyllables from "./fixtures/split-syllables.ttml?raw";
import standaloneBg from "./fixtures/standalone-bg.ttml?raw";
import { buildSpicyLines, groupSpicyTokens, type SpicyLine } from "./model";

const rows = (ttml: string, allowConsecutive = false) =>
	buildSpicyLines(parseLyric(ttml).lyricLines, false, false, allowConsecutive);

const shape = (lines: SpicyLine[]) =>
	lines.map((line) => [
		line.isDotLine ? "dot" : line.isBackground ? "bg" : "lead",
		line.startTime,
		line.endTime,
	]);

const groups = (line: SpicyLine) =>
	groupSpicyTokens(line.words).map((group) =>
		group.items.map(({ token }) => token.text),
	);

describe("Spicy fixtures render with Spicy Lyrics' line rules", () => {
	it("bg at end: the lead waits for its background vocal", () => {
		const lines = rows(bgAtEnd);
		expect(shape(lines)).toEqual([
			["lead", 1000, 5000],
			["bg", 2500, 5000],
			// The interlude starts once the background vocal ends, not at 3s.
			["dot", 5000, 8500],
			["lead", 8500, 10000],
		]);
		// At 4s the main words are done but the group is still being sung.
		expect(findSpicyScrollIndex(lines, 4000)).toBe(0);
		expect(lines[0].words.map((word) => word.text)).toEqual(["Hold", "on"]);
		expect(lines[1].words[0].text).toBe("longer");
	});

	it("bg before main: the group starts with the background and renders lead first", () => {
		const lines = rows(bgBeforeMain);
		expect(shape(lines)).toEqual([
			["lead", 1000, 4000],
			["bg", 1000, 1800],
			["lead", 4500, 6000],
		]);
		expect(findSpicyScrollIndex(lines, 1200)).toBe(0);
	});

	it("consecutive bg: nested only when the export would nest them", () => {
		const nested = rows(consecutiveBg, true);
		expect(shape(nested)).toEqual([
			["lead", 1000, 4000],
			["bg", 1500, 2500],
			["bg", 2500, 4000],
			["lead", 4200, 5000],
		]);
		expect(nested.slice(0, 3).every((line) => line.isDuet)).toBe(true);
		// The second background tail never drags the anchor back up.
		expect(findSpicyScrollIndex(nested, 3500)).toBe(0);

		// With the setting off the writer exports the second one as a lead.
		expect(shape(rows(consecutiveBg, false))).toEqual([
			["lead", 1000, 3000],
			["bg", 1500, 2500],
			["lead", 2500, 4000],
			["lead", 4200, 5000],
		]);
	});

	it("standalone bg: an empty lead holds it when consecutive bg is allowed", () => {
		const standalone = rows(standaloneBg, true);
		expect(shape(standalone)).toEqual([
			["lead", 1000, 2000],
			["bg", 1000, 2000],
			["lead", 2200, 3000],
		]);
		expect(standalone[0].words).toEqual([]);
		expect(findSpicyScrollIndex(standalone, 1500)).toBe(0);

		const asLead = rows(standaloneBg, false);
		expect(shape(asLead)).toEqual([
			["lead", 1000, 2000],
			["lead", 2200, 3000],
		]);
		expect(asLead[0].words[0].text).toBe("Alone");
	});

	it("split syllables join into one word; a comma ends the word", () => {
		const [line] = rows(splitSyllables);
		expect(groups(line)).toEqual([
			["Beau", "ti", "ful"],
			["one,"],
			["two"],
			["end"],
		]);
	});

	it("hyphenated parts stay joined only when their spans touch", () => {
		const [line] = rows(hyphens);
		expect(groups(line)).toEqual([["un-", "der"], ["Ah-"], ["ah-"], ["ah"]]);
	});

	it("fast rap: short words animate whole and overlapping lines keep the upper anchor", () => {
		const lines = rows(fastRap);
		expect(lines[0].words.every((word) => !word.letters)).toBe(true);
		expect(
			lines[0].words.every((word, index, all) =>
				index === all.length - 1 ? true : word.spaceAfter,
			),
		).toBe(true);
		// 1.95s to 2s both lines are active; the first finishes before the line
		// two rows down starts, so it keeps the anchor until it ends.
		expect(findSpicyScrollIndex(lines, 1980)).toBe(0);
		expect(findSpicyScrollIndex(lines, 2100)).toBe(1);
		// Blur follows the last active row, and holds when nothing is active.
		expect(findSpicyBlurAnchor(lines, 1980, -1)).toBe(1);
		expect(findSpicyBlurAnchor(lines, 5000, 2)).toBe(2);
	});
});
