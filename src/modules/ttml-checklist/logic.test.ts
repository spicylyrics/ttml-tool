import { describe, expect, it } from "vitest";
import {
	addChecklistEntry,
	deleteChecklistEntry,
	normalizeChecklistEntries,
	setChecklistEntryCompleted,
	updateChecklistEntry,
} from "./logic";

describe("TTML checklist", () => {
	it("adds newest active entries first", () => {
		const first = addChecklistEntry(
			[],
			{ song: "First", artist: "", notes: "" },
			1,
			"one",
		);
		const entries = addChecklistEntry(
			first,
			{ song: "Second", artist: "Artist", notes: "Idea" },
			2,
			"two",
		);
		expect(entries.map((entry) => entry.id)).toEqual(["two", "one"]);
	});

	it("edits, completes, and deletes entries", () => {
		const initial = addChecklistEntry(
			[],
			{ song: "Song", artist: "", notes: "" },
			1,
			"one",
		);
		const edited = updateChecklistEntry(initial, "one", {
			song: " Song 2 ",
			artist: "Artist",
			notes: "Note",
		});
		expect(edited[0]).toMatchObject({
			song: "Song 2",
			artist: "Artist",
			notes: "Note",
		});
		const completed = setChecklistEntryCompleted(edited, "one", true);
		expect(completed[0]?.completed).toBe(true);
		expect(deleteChecklistEntry(completed, "one")).toEqual([]);
	});

	it("normalizes persisted data and ignores malformed entries", () => {
		const entries = normalizeChecklistEntries([
			{ id: "valid", song: "  Song ", artist: 3, notes: null, completed: true },
			{ song: "Legacy" },
			{ id: "bad", song: "" },
			null,
		]);
		expect(entries).toEqual([
			{
				id: "legacy-1",
				song: "Legacy",
				artist: "",
				notes: "",
				completed: false,
				createdAt: 0,
			},
			{
				id: "valid",
				song: "Song",
				artist: "",
				notes: "",
				completed: true,
				createdAt: 0,
			},
		]);
	});

	it("keeps song list link fields and drops malformed ones", () => {
		const [linked, broken] = normalizeChecklistEntries([
			{
				id: "linked",
				song: "Song",
				createdAt: 2,
				projectId: "p1",
				projectDir: "C:/Projects/Song",
				startedAt: 5,
				geniusId: 42,
			},
			{
				id: "broken",
				song: "Other",
				createdAt: 1,
				projectId: "",
				startedAt: Number.NaN,
				geniusId: "42",
			},
		]);
		expect(linked).toMatchObject({
			projectId: "p1",
			projectDir: "C:/Projects/Song",
			startedAt: 5,
			geniusId: 42,
		});
		expect(broken).not.toHaveProperty("projectId");
		expect(broken).not.toHaveProperty("startedAt");
		expect(broken).not.toHaveProperty("geniusId");
		const edited = updateChecklistEntry([linked], "linked", {
			song: "Song",
			artist: "",
			notes: "",
		});
		expect(edited[0]?.projectId).toBe("p1");
	});
});
