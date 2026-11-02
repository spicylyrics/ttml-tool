import { createInstance } from "i18next";
import ICU from "i18next-icu";
import { describe, expect, it } from "vitest";
import { flattenStrings, placeholders } from "../../scripts/check-locales.mjs";
import english from "./locales/en-US/translation.json";
import { PSEUDO_LOCALE, pseudoCatalog, pseudoLocalize } from "./pseudo";

describe("pseudoLocalize", () => {
	it("accents, pads by about 40% and brackets plain text", () => {
		expect(pseudoLocalize("Save")).toBe("[Šåṽé··]");
		expect(pseudoLocalize("Open project")).toBe("[Öþéñ þŕöĵéçţ·····]");
	});

	it("keeps blank strings blank", () => {
		expect(pseudoLocalize("")).toBe("");
		expect(pseudoLocalize("  ")).toBe("  ");
	});

	it("leaves interpolation, ICU arguments and tags untouched", () => {
		expect(pseudoLocalize("Hi {{name}}")).toBe("[Ĥî {{name}}··]");
		expect(pseudoLocalize("Delete {title}?")).toBe("[Ðéļéţé {title}?····]");
		expect(pseudoLocalize("<0>Docs</0> {{- url}}")).toBe(
			"[<0>Ðöçš</0> {{- url}}··]",
		);
		expect(pseudoLocalize("At {time, number, integer}s")).toBe(
			"[Åţ {time, number, integer}š··]",
		);
	});

	it("translates plural and select branches but not their keywords", () => {
		expect(
			pseudoLocalize("{count, plural, one {# line} other {# lines}}"),
		).toBe("[{count, plural, one {# ļîñé···} other {# ļîñéš···}}]");
		expect(
			pseudoLocalize("{n, plural, offset:1 =0 {none} other {# more}}"),
		).toBe("[{n, plural, offset:1 =0 {ñöñé··} other {# ɱöŕé···}}]");
		expect(pseudoLocalize("{who, select, me {You} other {Them}}")).toBe(
			"[{who, select, me {Ýöû··} other {Ţĥéɱ··}}]",
		);
	});

	it("copies ICU-quoted text verbatim", () => {
		expect(pseudoLocalize("Use '{braces}' and ''quotes''")).toBe(
			"[Ûšé '{braces}' åñð ''ǫûöţéš''············]",
		);
	});

	it("still brackets text it cannot parse", () => {
		expect(pseudoLocalize("Broken {count, plural, one {x}")).toBe(
			"[Broken {count, plural, one {x}]",
		);
	});

	it("keeps every en-US placeholder and the catalog shape", () => {
		const pseudo = pseudoCatalog(english);
		const source = flattenStrings(english) as Record<string, string>;
		const target = flattenStrings(pseudo) as Record<string, string>;
		expect(Object.keys(target)).toEqual(Object.keys(source));
		for (const [key, value] of Object.entries(source)) {
			expect(placeholders(target[key]), key).toEqual(placeholders(value));
			if (value.trim()) expect(target[key], key).toMatch(/^\[[\s\S]*\]$/);
		}
	});

	it("formats with i18next and ICU like en-US", async () => {
		const i18n = createInstance();
		await i18n.use(ICU).init({
			lng: PSEUDO_LOCALE,
			fallbackLng: "en-US",
			interpolation: { escapeValue: false },
			resources: {
				[PSEUDO_LOCALE]: {
					translation: pseudoCatalog({
						lines: "{count, plural, one {# line} other {# lines}}",
						name: "Hi {name}",
					}),
				},
			},
		});
		// These test keys are not in the typed en-US catalog.
		const t = i18n.t as unknown as (key: string, options: object) => string;
		expect(t("lines", { count: 1 })).toBe("[1 ļîñé···]");
		expect(t("lines", { count: 3 })).toBe("[3 ļîñéš···]");
		expect(t("name", { name: "Ana" })).toBe("[Ĥî Ana··]");
	});
});
