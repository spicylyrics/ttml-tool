import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { entryProblems } from "./changelog-format.mjs";

const read = (path) =>
	JSON.parse(readFileSync(new URL(path, import.meta.url), "utf8"));

describe("entryProblems", () => {
	it("accepts a bold lead and one short sentence", () => {
		expect(
			entryProblems({
				title: "Spectrogram follows the playhead",
				body: "Toggle it with `Shift+P`, or pick **Page** or **Continuous**",
			}),
		).toEqual([]);
	});
	it("flags final punctuation, extra sentences and long text", () => {
		expect(entryProblems({ title: "Done.", body: "Yes." })).toEqual([
			"title ends with punctuation",
			"body ends with punctuation",
		]);
		expect(entryProblems({ title: "Two", body: "One. Two" })).toEqual([
			"body is more than one sentence",
		]);
		expect(entryProblems({ title: "x".repeat(61), body: "y" })).toEqual([
			"title is over 60 characters",
			"title starts lowercase",
		]);
		expect(entryProblems({ title: "**Bold lead**", body: "Yes" })).toEqual([
			"title has markdown",
		]);
		expect(entryProblems({ title: "Lead" })).toEqual([
			"a one-sentence body is required",
		]);
	});
});

describe("compiled changelog", () => {
	const releases = [
		...read("../src/data/changelog.json"),
		read("../src/data/changelog-legacy.json"),
	];
	it.each(
		releases.flatMap((release) =>
			release.entries.map((entry) => [
				release.version ?? release.summary,
				entry.title,
				entry,
			]),
		),
	)("%s: %s fits the format", (_version, _title, entry) => {
		expect(entryProblems(entry)).toEqual([]);
	});
});
