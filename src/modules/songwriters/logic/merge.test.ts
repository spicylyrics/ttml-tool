import { describe, expect, it } from "vitest";
import {
	addSongwriters,
	isPreselected,
	mergeWriters,
	nameFor,
	normalizeName,
} from "./merge";

describe("normalizeName", () => {
	it("ignores case, accents and punctuation", () => {
		expect(normalizeName("Beyoncé Knowles-Carter")).toBe(
			normalizeName("beyonce knowles carter"),
		);
	});

	it("keeps non-Latin letters", () => {
		expect(normalizeName("米津 玄師")).toBe("米津玄師");
	});
});

describe("mergeWriters", () => {
	const results = [
		{
			source: "genius" as const,
			match: null,
			writers: [
				{ credited: "Taylor Swift" },
				{ credited: "Shellback", legal: "Karl Johan Schuster" },
				{ credited: "Someone Else" },
			],
		},
		{
			source: "musicbrainz" as const,
			match: null,
			writers: [
				{ credited: "Max Martin", legal: "Martin Karl Sandberg" },
				{ credited: "Shellback", legal: "Johan Karl Schuster" },
				{ credited: "Taylor Swift", legal: "Taylor Alison Swift" },
			],
		},
	];

	it("joins the same person across sources and prefers MusicBrainz legal names", () => {
		const rows = mergeWriters(results, []);
		expect(rows.map((row) => row.credited)).toEqual([
			"Max Martin",
			"Shellback",
			"Taylor Swift",
			"Someone Else",
		]);
		const shellback = rows.find((row) => row.credited === "Shellback");
		expect(shellback?.legal).toBe("Johan Karl Schuster");
		expect(shellback?.sources).toEqual(["musicbrainz", "genius"]);
	});

	it("matches a source that only gives the legal name", () => {
		const rows = mergeWriters(
			[
				{
					source: "musicbrainz",
					match: null,
					writers: [{ credited: "Max Martin", legal: "Martin Karl Sandberg" }],
				},
				{
					source: "genius",
					match: null,
					writers: [{ credited: "Martin Karl Sandberg" }],
				},
			],
			[],
		);
		expect(rows).toHaveLength(1);
		expect(rows[0].sources).toEqual(["musicbrainz", "genius"]);
	});

	it("marks names already in the list by either name", () => {
		const rows = mergeWriters(results, ["Martin Karl Sandberg", ""]);
		expect(
			rows.find((row) => row.credited === "Max Martin")?.alreadyAdded,
		).toBe(true);
		expect(
			rows.find((row) => row.credited === "Taylor Swift")?.alreadyAdded,
		).toBe(false);
	});

	it("preselects names every source with credits agrees on", () => {
		const rows = mergeWriters(results, []);
		const picked = rows.filter((row) => isPreselected(row, 2));
		expect(picked.map((row) => row.credited)).toEqual([
			"Shellback",
			"Taylor Swift",
		]);
		expect(rows.every((row) => isPreselected(row, 1))).toBe(true);
	});
});

describe("nameFor", () => {
	const row = {
		id: "x",
		credited: "Shellback",
		legal: "Johan Karl Schuster",
		sources: [],
		alreadyAdded: false,
	};

	it("uses the legal name when asked and known", () => {
		expect(nameFor(row, true)).toBe("Johan Karl Schuster");
		expect(nameFor(row, false)).toBe("Shellback");
		expect(nameFor({ ...row, legal: undefined }, true)).toBe("Shellback");
	});
});

describe("addSongwriters", () => {
	it("appends new names, drops empty slots and skips duplicates", () => {
		expect(
			addSongwriters(["Taylor Swift", ""], ["taylor swift", " Max Martin "]),
		).toEqual(["Taylor Swift", "Max Martin"]);
	});
});
