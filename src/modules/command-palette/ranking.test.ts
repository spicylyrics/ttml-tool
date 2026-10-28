import { describe, expect, it } from "vitest";
import { rankPaletteItems, scorePaletteItem } from "./ranking";
import { pushRecent } from "./states";

const items = [
	{ id: "undo", label: "Edit - Undo" },
	{ id: "redo", label: "Edit - Redo" },
	{ id: "timeShift", label: "Tools - Time shift" },
	{ id: "playPause", label: "Audio - Play / pause" },
	{ id: "audio", label: "Audio", keywords: "volume equalizer spectrogram" },
	{ id: "editor", label: "Editor & sync", keywords: "timing offset" },
];

const ids = (list: { id: string }[]) => list.map((item) => item.id);

describe("scorePaletteItem", () => {
	it("ranks prefix over word start over substring over scattered letters", () => {
		const item = { id: "x", label: "Play pause" };
		const prefix = scorePaletteItem(item, "pla");
		const wordStart = scorePaletteItem(item, "pau");
		const substring = scorePaletteItem(item, "aus");
		const scattered = scorePaletteItem(item, "ppse");
		expect(prefix).toBeGreaterThan(wordStart);
		expect(wordStart).toBeGreaterThan(substring);
		expect(substring).toBeGreaterThan(scattered);
		expect(scattered).toBeGreaterThan(0);
	});

	it("needs every word of the query to match", () => {
		expect(scorePaletteItem(items[2], "time shift")).toBeGreaterThan(0);
		expect(scorePaletteItem(items[2], "time stretch")).toBe(0);
	});

	it("matches keywords but weighs them below the label", () => {
		expect(scorePaletteItem(items[4], "equalizer")).toBeGreaterThan(0);
		expect(scorePaletteItem(items[4], "audio")).toBeGreaterThan(
			scorePaletteItem(items[4], "equalizer"),
		);
	});

	it("ignores case and accents", () => {
		expect(
			scorePaletteItem({ id: "x", label: "Edición" }, "EDICION"),
		).toBeGreaterThan(0);
	});

	it("returns 0 for an empty query or no match", () => {
		expect(scorePaletteItem(items[0], "   ")).toBe(0);
		expect(scorePaletteItem(items[0], "zzz")).toBe(0);
	});
});

describe("rankPaletteItems", () => {
	it("lists recent items first, newest first, when the query is empty", () => {
		expect(ids(rankPaletteItems(items, "", ["audio", "redo"]))).toEqual([
			"audio",
			"redo",
			"undo",
			"timeShift",
			"playPause",
			"editor",
		]);
	});

	it("ignores recent ids that no longer exist", () => {
		expect(ids(rankPaletteItems(items, "", ["gone"]))).toEqual(ids(items));
	});

	it("drops non-matches and sorts by score", () => {
		expect(ids(rankPaletteItems(items, "audio"))).toEqual([
			"audio",
			"playPause",
		]);
		expect(ids(rankPaletteItems(items, "shift"))).toEqual(["timeShift"]);
	});

	it("breaks ties in favor of recent items", () => {
		expect(ids(rankPaletteItems(items, "edit"))).toEqual([
			"undo",
			"redo",
			"editor",
		]);
		expect(ids(rankPaletteItems(items, "edit", ["redo"]))).toEqual([
			"redo",
			"undo",
			"editor",
		]);
	});

	it("keeps the given order for equal scores", () => {
		const same = [
			{ id: "a", label: "Seek" },
			{ id: "b", label: "Seek" },
		];
		expect(ids(rankPaletteItems(same, "seek"))).toEqual(["a", "b"]);
	});
});

describe("pushRecent", () => {
	it("moves the item to the front without duplicates and caps the list", () => {
		expect(pushRecent(["a", "b", "c"], "b")).toEqual(["b", "a", "c"]);
		const long = Array.from({ length: 8 }, (_, index) => `${index}`);
		expect(pushRecent(long, "new")).toHaveLength(8);
		expect(pushRecent(long, "new")[0]).toBe("new");
	});
});
