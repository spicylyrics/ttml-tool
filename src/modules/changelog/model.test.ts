import { describe, expect, it } from "vitest";
import changelog from "$/data/changelog.json";
import legacy from "$/data/changelog-legacy.json";
import { buildReleaseCards, sectionOf, toReleaseCard } from "./model";

const release = {
	version: "0.17.0",
	summary: "Changelog screen",
	color: "iris",
	date: "2026-10-28",
	entries: [
		{ type: "feature", title: "Big", highlight: true },
		{ type: "feature", title: "Small", highlight: false },
		{ type: "change", title: "Renamed", highlight: false },
		{ type: "fix", title: "Crash", highlight: true },
		{ type: "fix", title: "Typo", highlight: false },
	],
};

describe("changelog screen model", () => {
	it("maps note types to New, Changed and Fixed", () => {
		expect(sectionOf({ type: "feature" })).toBe("new");
		expect(sectionOf({ type: "change" })).toBe("changed");
		expect(sectionOf({ type: "fix" })).toBe("fixed");
		expect(sectionOf({})).toBe("new");
		expect(sectionOf({ type: "unknown" })).toBe("changed");
	});

	it("puts highlights up top and the rest in section order without repeats", () => {
		const card = toReleaseCard(release);
		expect(card.highlights.map((entry) => entry.title)).toEqual([
			"Big",
			"Crash",
		]);
		expect(
			card.sections.map(({ section, entries }) => [
				section,
				entries.map((entry) => entry.title),
			]),
		).toEqual([
			["new", ["Small"]],
			["changed", ["Renamed"]],
			["fixed", ["Typo"]],
		]);
		expect(card.summary).toBe("Changelog screen");
	});

	it("leaves out empty sections and, in highlights-only view, empty releases", () => {
		const quiet = {
			version: "0.16.1",
			entries: [{ type: "fix", title: "Only fix", highlight: false }],
		};
		expect(toReleaseCard(quiet).sections.map((s) => s.section)).toEqual([
			"fixed",
		]);
		expect(
			buildReleaseCards([release, quiet], undefined, { highlightsOnly: true }),
		).toHaveLength(1);
	});

	it("reads the shipped changelog and the legacy block", () => {
		const cards = buildReleaseCards(changelog, legacy);
		expect(cards).toHaveLength(changelog.length + 1);
		expect(cards[0].version).toBe(changelog[0].version);
		const last = cards[cards.length - 1];
		expect(last?.version).toBeUndefined();
		expect(last?.summary).toBe(legacy.summary);
		const total = (card: (typeof cards)[number]) =>
			card.highlights.length +
			card.sections.reduce((sum, group) => sum + group.entries.length, 0);
		expect(total(cards[0])).toBe(changelog[0].entries.length);
		expect(last && total(last)).toBe(legacy.entries.length);
	});
});
