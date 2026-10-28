import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { RIBBON_MODES, RIBBON_SECTION_CATALOG } from "./catalog";

const LOCALES_DIR = join(__dirname, "../../../i18n/locales");
const locales = readdirSync(LOCALES_DIR);

const lookup = (catalog: unknown, key: string): unknown =>
	key
		.split(".")
		.reduce<unknown>(
			(node, part) =>
				node && typeof node === "object"
					? (node as Record<string, unknown>)[part]
					: undefined,
			catalog,
		);

describe("ribbon section catalog", () => {
	it.each(
		locales,
	)("every section label exists and is unique per ribbon in %s", (locale) => {
		const translation = JSON.parse(
			readFileSync(join(LOCALES_DIR, locale, "translation.json"), "utf8"),
		);
		for (const mode of RIBBON_MODES) {
			const labels = RIBBON_SECTION_CATALOG[mode].map((key) =>
				lookup(translation, key),
			);
			for (const [index, label] of labels.entries()) {
				expect(
					typeof label,
					`${RIBBON_SECTION_CATALOG[mode][index]} in ${locale}`,
				).toBe("string");
			}
			// Sections are recognised by their label, so two sections on one
			// ribbon must never share a translation.
			expect(new Set(labels).size, `${mode} labels in ${locale}`).toBe(
				labels.length,
			);
		}
	});
});
