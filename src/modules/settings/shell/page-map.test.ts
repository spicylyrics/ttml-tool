import { describe, expect, it } from "vitest";
import { settingsSearchKeywords } from "../logic/settings-search";
import {
	CLASSIC_SECTIONS,
	type ClassicPageId,
	resolveShellPage,
	SHELL_PAGE_MAP,
	toClassicPage,
} from "./page-map";

const classicPages = Object.keys(CLASSIC_SECTIONS) as ClassicPageId[];

describe("shell page map", () => {
	it("places every classic section on exactly one shell page", () => {
		const placed = SHELL_PAGE_MAP.flatMap((page) => page.sections);
		const classic = classicPages.flatMap((page) => CLASSIC_SECTIONS[page]);
		expect([...placed].sort()).toEqual([...classic].sort());
		expect(new Set(placed).size).toBe(placed.length);
	});

	it("has unique page ids", () => {
		const ids = SHELL_PAGE_MAP.map((page) => page.value);
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("points each page back at the classic page its sections came from", () => {
		for (const page of SHELL_PAGE_MAP) {
			for (const section of page.sections) {
				expect(CLASSIC_SECTIONS[page.classic]).toContain(section);
			}
		}
	});

	it("opens a shell page for every classic and retired tab id", () => {
		const ids = new Set(SHELL_PAGE_MAP.map((page) => page.value));
		for (const tab of [...classicPages, "assistant", "ai", "dev", "nope"]) {
			expect(ids.has(resolveShellPage(tab))).toBe(true);
		}
		expect(resolveShellPage("editor")).toBe("syncing");
		expect(resolveShellPage("audio")).toBe("audio");
		expect(resolveShellPage("dev")).toBe("common");
	});

	it("maps every shell page back to a classic page", () => {
		for (const page of SHELL_PAGE_MAP) {
			expect(classicPages).toContain(toClassicPage(page.value));
		}
		expect(toClassicPage("experimental")).toBe("common");
		expect(toClassicPage("backup")).toBe("files");
		expect(toClassicPage("preview")).toBe("editor");
		// A classic id survives the round trip.
		for (const page of classicPages) {
			expect(toClassicPage(page)).toBe(page);
		}
	});

	it("keeps every classic search keyword on some shell page", () => {
		const shellWords = new Set(
			SHELL_PAGE_MAP.flatMap((page) => page.keywords.split(/\s+/)),
		);
		for (const page of classicPages) {
			for (const word of settingsSearchKeywords[page]?.split(/\s+/) ?? []) {
				expect(shellWords, `"${word}" from ${page}`).toContain(word);
			}
		}
	});
});
