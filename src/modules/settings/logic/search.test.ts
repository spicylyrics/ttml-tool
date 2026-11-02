import { describe, expect, it } from "vitest";
import {
	type PageSnapshot,
	pickActivePage,
	type SearchablePage,
	searchSettingsPages,
} from "./search";

const pages: SearchablePage[] = [
	{ value: "common", label: "General", keywords: "language privacy" },
	{ value: "audio", label: "Audio", keywords: "volume equalizer" },
	{ value: "about", label: "About", keywords: "version" },
];

const snapshots: Record<string, PageSnapshot> = {
	common: {
		text: "Display Interface language Compact background Privacy Discord presence",
		groups: ["Display", "Privacy"],
		rows: [
			{ text: "Interface language", group: 0 },
			{ text: "Compact background vocals", group: 0 },
			{ text: "Discord presence", group: 1 },
		],
	},
	audio: {
		text: "Playback Volume Speed Audio output",
		groups: ["Playback"],
		rows: [
			{ text: "Volume", group: 0 },
			{ text: "Speed", group: 0 },
			{ text: "Audio output device", group: 0 },
		],
	},
	about: { text: "Version 1.0", groups: [], rows: [] },
};

const byValue = (results: ReturnType<typeof searchSettingsPages>) =>
	Object.fromEntries(results.map((result) => [result.value, result]));

describe("searchSettingsPages", () => {
	it("shows every page whole without a query", () => {
		const results = byValue(searchSettingsPages(pages, snapshots, "  "));
		expect(results.common).toEqual({
			value: "common",
			visible: true,
			matchCount: 0,
			rows: [true, true, true],
			groups: [true, true],
		});
		expect(results.about.visible).toBe(true);
	});

	it("filters a page down to its matching rows and their headings", () => {
		const results = byValue(searchSettingsPages(pages, snapshots, "discord"));
		expect(results.common).toMatchObject({
			visible: true,
			matchCount: 1,
			rows: [false, false, true],
			groups: [false, true],
		});
		expect(results.audio.visible).toBe(false);
		expect(results.about.visible).toBe(false);
	});

	it("matches a row on its heading plus its own text", () => {
		const results = byValue(
			searchSettingsPages(pages, snapshots, "display language"),
		);
		expect(results.common.rows).toEqual([true, false, false]);
	});

	it("shows a page whole when the query names the page", () => {
		const results = byValue(searchSettingsPages(pages, snapshots, "audio"));
		expect(results.audio).toMatchObject({
			visible: true,
			matchCount: 0,
			rows: [true, true, true],
		});
	});

	it("keeps a keyword-only match visible and whole", () => {
		const results = byValue(searchSettingsPages(pages, snapshots, "equalizer"));
		expect(results.audio).toMatchObject({
			visible: true,
			matchCount: 0,
			rows: [true, true, true],
		});
	});

	it("falls back to labels and keywords before pages render", () => {
		const results = byValue(searchSettingsPages(pages, null, "version"));
		expect(results.about).toEqual({
			value: "about",
			visible: true,
			matchCount: 0,
			rows: [],
			groups: [],
		});
		expect(results.common.visible).toBe(false);
	});

	it("keeps headings that have no rows under them", () => {
		const results = byValue(
			searchSettingsPages(
				[{ value: "keys", label: "Shortcuts", keywords: "" }],
				{
					keys: {
						text: "Intro Edit Undo",
						groups: ["Intro", "Edit"],
						rows: [{ text: "Undo", group: 1 }],
					},
				},
				"undo",
			),
		);
		expect(results.keys.groups).toEqual([true, true]);
	});

	it("ignores accents and case", () => {
		const results = byValue(
			searchSettingsPages(
				[{ value: "x", label: "X", keywords: "" }],
				{
					x: {
						text: "Edición",
						groups: [],
						rows: [{ text: "Edición", group: -1 }],
					},
				},
				"EDICION",
			),
		);
		expect(results.x.matchCount).toBe(1);
	});
});

describe("pickActivePage", () => {
	const results = searchSettingsPages(pages, snapshots, "discord");

	it("stays on the current page while it matches", () => {
		expect(pickActivePage("common", results)).toBe("common");
	});

	it("jumps to the first matching page", () => {
		expect(pickActivePage("about", results)).toBe("common");
	});

	it("stays put when nothing matches", () => {
		expect(
			pickActivePage("about", searchSettingsPages(pages, snapshots, "zzz")),
		).toBe("about");
	});
});
