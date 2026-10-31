import { describe, expect, it } from "vitest";
import {
	matchesSettingsPage,
	matchesSettingsSearch,
	settingsSearchKeywords,
} from "./settings-search";

describe("settings search", () => {
	it("keeps all categories for an empty query", () => {
		expect(matchesSettingsSearch("Appearance", "  ")).toBe(true);
	});

	it("ignores case and extra whitespace", () => {
		expect(
			matchesSettingsSearch(
				"Music volume playback speed",
				"  PLAYBACK   speed ",
			),
		).toBe(true);
	});

	it("matches words in any order and requires every word", () => {
		expect(
			matchesSettingsSearch("Global Sync Time Offset", "offset sync"),
		).toBe(true);
		expect(
			matchesSettingsSearch("Global Sync Time Offset", "offset volume"),
		).toBe(false);
	});

	it("matches translated labels", () => {
		expect(matchesSettingsSearch("Apariencia", "apariencia")).toBe(true);
	});

	it.each([
		["folder project", "files"],
		["compact background", "common"],
		["autosave", "backup"],
		["wrap", "syncing"],
		["vsync", "preview"],
		["ribbon", "editing"],
		["equalizer", "audio"],
		["font", "appearance"],
		["spicy lyrics design", "appearance"],
		["shortcut", "keybinding"],
	])("finds %s in the current dev category", (query, expected) => {
		const matches = Object.entries(settingsSearchKeywords)
			.filter(([, keywords]) => matchesSettingsSearch(keywords, query))
			.map(([value]) => value);
		expect(matches).toContain(expected);
	});

	it("ignores accents on both sides", () => {
		expect(matchesSettingsSearch("Edición", "edicion")).toBe(true);
		expect(matchesSettingsSearch("Synchronisation", "synchronisatión")).toBe(
			true,
		);
	});

	it("matches a page by its rendered text in any language", () => {
		const page = {
			label: "Archivos y almacenamiento",
			keywords: settingsSearchKeywords.files,
			text: "Instantáneas para conservar. Las más antiguas se eliminan primero.",
		};
		expect(matchesSettingsPage(page, "instantaneas")).toBe(true);
		expect(matchesSettingsPage(page, "mas antiguas")).toBe(true);
		expect(matchesSettingsPage(page, "ecualizador")).toBe(false);
	});

	it("falls back to keywords for rows the page isn't rendering", () => {
		const page = {
			label: "Appearance",
			keywords: settingsSearchKeywords.appearance,
			text: "Theme Background Font",
		};
		expect(matchesSettingsPage(page, "scrollbar")).toBe(true);
		expect(matchesSettingsPage({ ...page, text: undefined }, "font")).toBe(
			true,
		);
	});

	it("returns no matches for an unknown setting", () => {
		expect(
			Object.values(settingsSearchKeywords).some((keywords) =>
				matchesSettingsSearch(keywords, "nonexistent-setting"),
			),
		).toBe(false);
	});
});
