import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import {
	formatTable,
	hasNoWords,
	localeCompleteness,
	readCompleteness,
} from "./locale-completeness.mjs";

const source = {
	dialog: { title: "Delete project", ok: "OK" },
	brand: "Genius",
	count: "{{count}}",
	plural: "{count, plural, one {# line} other {# lines}}",
	blank: "",
};

describe("locale completeness", () => {
	it("counts keys that are present and differ from English", () => {
		const report = localeCompleteness(
			source,
			{
				dialog: { title: "Supprimer le projet", ok: "OK" },
				brand: "Genius",
				count: "{{count}}",
				plural: "{count, plural, one {# ligne} other {# lignes}}",
				blank: "",
			},
			"fr-FR",
			{ "*": ["brand"] },
		);
		expect(report.identical).toEqual(["dialog.ok"]);
		expect(report.missing).toEqual([]);
		expect(report.translated).toBe(5);
		expect(report.total).toBe(6);
		expect(report.percent).toBe(83.3);
	});

	it("reports missing and blank keys separately from identical ones", () => {
		const report = localeCompleteness(
			source,
			{ dialog: { title: "", ok: "D'accord" }, brand: "Genius" },
			"fr-FR",
			{},
		);
		expect(report.missing).toEqual([
			"dialog.title",
			"count",
			"plural",
			"blank",
		]);
		expect(report.identical).toEqual(["brand"]);
		expect(report.translated).toBe(1);
	});

	it("applies locale-specific allowlist entries only to that locale", () => {
		const target = { ...source };
		const allowlist = { "fr-FR": ["dialog.ok", "dialog.title"] };
		expect(
			localeCompleteness(source, target, "fr-FR", allowlist).identical,
		).toEqual(["brand", "plural"]);
		expect(
			localeCompleteness(source, target, "nl-NL", allowlist).identical,
		).toEqual(["dialog.title", "dialog.ok", "brand", "plural"]);
	});

	it("treats strings without words as translated", () => {
		expect(hasNoWords("{{count}}")).toBe(true);
		expect(hasNoWords("{name} %")).toBe(true);
		expect(hasNoWords("<0>{name}</0>")).toBe(true);
		expect(hasNoWords("{{count}} lines")).toBe(false);
		expect(hasNoWords("文件")).toBe(false);
	});

	it("reads every real catalog without errors and prints a table", () => {
		const root = fileURLToPath(new URL("../src/i18n/locales", import.meta.url));
		const reports = readCompleteness(root);
		expect(reports.length).toBeGreaterThan(0);
		expect(reports.some((report) => report.locale === "en-US")).toBe(false);
		for (const report of reports) {
			expect(report.percent).toBeGreaterThanOrEqual(0);
			expect(report.percent).toBeLessThanOrEqual(100);
		}
		const table = formatTable(reports).split("\n");
		expect(table[0]).toMatch(/^Locale\s+Done/);
		expect(table).toHaveLength(reports.length + 1);
	});
});
