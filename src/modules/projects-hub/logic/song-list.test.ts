import { describe, expect, it } from "vitest";
import {
	addChecklistEntry,
	type TTMLChecklistEntry,
} from "$/modules/ttml-checklist/logic";
import {
	addGeniusSong,
	findExportedEntry,
	findOpenEntry,
	linkEntryToProject,
	linkEntryToProjectDir,
	markExportedEntryDone,
	songListMetadata,
} from "./song-list";

const list = (): TTMLChecklistEntry[] => {
	const one = addChecklistEntry(
		[],
		{ song: "First Song", artist: "Some Artist", notes: "" },
		1,
		"one",
	);
	return addChecklistEntry(
		one,
		{ song: "Second Song", artist: "", notes: "remix" },
		2,
		"two",
	);
};

const meta = (title: string, artist?: string) => [
	{ key: "musicName", value: [title] },
	...(artist ? [{ key: "artists", value: [artist] }] : []),
];

describe("song list", () => {
	it("finds an open entry ignoring case, spacing and curly quotes", () => {
		const entries = addChecklistEntry(
			[],
			{ song: "Don\u2019t  Stop", artist: "Band", notes: "" },
			1,
			"q",
		);
		expect(findOpenEntry(entries, "don't stop", "BAND")?.id).toBe("q");
		expect(findOpenEntry(entries, "don't stop", "")?.id).toBe("q");
		expect(findOpenEntry(entries, "don't stop", "Other")).toBeUndefined();
	});

	it("adds a Genius song once and keeps its id", () => {
		const first = addGeniusSong(
			list(),
			{ song: "Third Song", artist: "X", geniusId: 7 },
			3,
			"three",
		);
		expect(first.added).toBe(true);
		expect(first.entries[0]).toMatchObject({ id: "three", geniusId: 7 });
		const again = addGeniusSong(first.entries, {
			song: "third song",
			artist: "x",
			geniusId: 7,
		});
		expect(again.added).toBe(false);
		expect(again.entries).toBe(first.entries);
	});

	it("builds metadata without an empty artist row", () => {
		expect(songListMetadata({ song: "Song", artist: " " })).toEqual([
			{ key: "musicName", value: ["Song"] },
		]);
		expect(songListMetadata({ song: "Song", artist: "A" })).toEqual(
			meta("Song", "A"),
		);
	});

	it("links an entry to the started document and its folder", () => {
		const linked = linkEntryToProject(list(), "one", "p1", 10);
		expect(linked.find((e) => e.id === "one")).toMatchObject({
			projectId: "p1",
			startedAt: 10,
		});
		const withDir = linkEntryToProjectDir(linked, "p1", "C:/Songs/First");
		expect(withDir.find((e) => e.id === "one")?.projectDir).toBe(
			"C:/Songs/First",
		);
		expect(linkEntryToProjectDir(withDir, "p1", "C:/Songs/First")).toBe(
			withDir,
		);
		// Starting again drops the old folder link.
		const restarted = linkEntryToProject(withDir, "one", "p2", 11);
		expect(restarted.find((e) => e.id === "one")).not.toHaveProperty(
			"projectDir",
		);
	});

	it("matches an export by project id, then folder, then started title", () => {
		const entries = linkEntryToProjectDir(
			linkEntryToProject(list(), "one", "p1", 10),
			"p1",
			"C:/Songs/First",
		);
		expect(
			findExportedEntry(entries, { projectId: "p1", metadata: [] })?.id,
		).toBe("one");
		expect(
			findExportedEntry(entries, {
				projectId: "other",
				projectDir: "C:/Songs/First",
				metadata: [],
			})?.id,
		).toBe("one");
		expect(
			findExportedEntry(entries, {
				projectId: "other",
				metadata: meta("first song", "some artist"),
			})?.id,
		).toBe("one");
	});

	it("never marks an entry that wasn't started", () => {
		expect(
			findExportedEntry(list(), {
				projectId: "x",
				metadata: meta("Second Song"),
			}),
		).toBeUndefined();
	});

	it("marks the exported entry done and leaves others alone", () => {
		const entries = linkEntryToProject(list(), "two", "p2", 10);
		const result = markExportedEntryDone(entries, {
			projectId: "p2",
			metadata: [],
		});
		expect(result.entry?.id).toBe("two");
		expect(result.entries.find((e) => e.id === "two")?.completed).toBe(true);
		expect(result.entries.find((e) => e.id === "one")?.completed).toBe(false);
		const none = markExportedEntryDone(entries, {
			projectId: "nope",
			metadata: [],
		});
		expect(none.entries).toBe(entries);
		expect(none.entry).toBeUndefined();
	});
});
