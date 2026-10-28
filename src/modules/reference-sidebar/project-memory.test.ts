import { describe, expect, it } from "vitest";
import {
	normalizeMemory,
	REFERENCE_SIDEBAR_MAX_WIDTH,
	REFERENCE_SIDEBAR_MIN_WIDTH,
	readProjectState,
	resolveVisibleTab,
	writeProjectState,
} from "./project-memory";

const song = { id: 42, name: "Song", artist: "Artist" };

describe("reference sidebar project memory", () => {
	it("starts collapsed on the Preview tab with nothing saved", () => {
		expect(readProjectState({}, "id:a")).toEqual({
			open: false,
			tab: "preview",
			updatedAt: 0,
		});
	});

	it("keeps each project's tab, width and song apart", () => {
		let memory = writeProjectState(
			{},
			"id:a",
			{ open: true, tab: "genius" },
			1,
		);
		memory = writeProjectState(memory, "id:a", { genius: song, width: 420 }, 2);
		memory = writeProjectState(memory, "id:b", { open: false }, 3);

		expect(readProjectState(memory, "id:a")).toEqual({
			open: true,
			tab: "genius",
			width: 420,
			genius: song,
			updatedAt: 2,
		});
		expect(readProjectState(memory, "id:b")).toMatchObject({
			open: false,
			tab: "genius",
			width: 420,
		});
		expect(readProjectState(memory, "id:b").genius).toBeUndefined();
	});

	it("starts a new project like the last one used, without its Genius song", () => {
		let memory = writeProjectState({}, "id:old", { tab: "preview" }, 1);
		memory = writeProjectState(
			memory,
			"id:recent",
			{ open: true, tab: "genius", width: 500, genius: song },
			5,
		);
		expect(readProjectState(memory, "id:new")).toEqual({
			open: true,
			tab: "genius",
			width: 500,
			updatedAt: 0,
		});
	});

	it("clears the Genius song when asked to", () => {
		const memory = writeProjectState({}, "id:a", { genius: song }, 1);
		const cleared = writeProjectState(memory, "id:a", { genius: null }, 2);
		expect(readProjectState(cleared, "id:a").genius).toBeUndefined();
	});

	it("drops the least recently used projects past the limit", () => {
		let memory = {};
		for (let i = 0; i < 5; i++)
			memory = writeProjectState(memory, `id:${i}`, { open: true }, i, 3);
		expect(Object.keys(memory).sort()).toEqual(["id:2", "id:3", "id:4"]);

		memory = writeProjectState(memory, "id:2", { tab: "genius" }, 10, 3);
		memory = writeProjectState(memory, "id:5", { open: true }, 11, 3);
		expect(Object.keys(memory).sort()).toEqual(["id:2", "id:4", "id:5"]);
	});

	it("clamps widths to the panel's limits", () => {
		const narrow = writeProjectState({}, "id:a", { width: 10 }, 1);
		const wide = writeProjectState({}, "id:a", { width: 5000 }, 1);
		expect(narrow["id:a"].width).toBe(REFERENCE_SIDEBAR_MIN_WIDTH);
		expect(wide["id:a"].width).toBe(REFERENCE_SIDEBAR_MAX_WIDTH);
	});

	it("ignores malformed stored values", () => {
		expect(normalizeMemory(null)).toEqual({});
		expect(normalizeMemory("nope")).toEqual({});
		expect(normalizeMemory([1, 2])).toEqual({});
		expect(
			normalizeMemory({
				broken: 7,
				ok: {
					open: true,
					tab: "lyrics",
					width: "wide",
					genius: { id: "x" },
					updatedAt: 3,
				},
				song: { open: "yes", tab: "genius", genius: song, width: 450 },
			}),
		).toEqual({
			ok: { open: true, tab: "preview", updatedAt: 3 },
			song: {
				open: false,
				tab: "genius",
				genius: song,
				width: 450,
				updatedAt: 0,
			},
		});
	});

	it("falls back to Preview when the saved tab is hidden", () => {
		expect(resolveVisibleTab("problems", ["preview", "genius"])).toBe(
			"preview",
		);
		expect(resolveVisibleTab("genius", ["preview", "genius"])).toBe("genius");
	});
});
