import { createInstance } from "i18next";
import ICU from "i18next-icu";
import { describe, expect, it } from "vitest";
import { getTranslationProgress } from "$/modules/settings/modals/common/language";
import enUS from "./locales/en-US/translation.json";
import esES from "./locales/es-ES/translation.json";
import ptBR from "./locales/pt-BR/translation.json";
import {
	fallbackLanguages,
	mergeCatalog,
	regionalBase,
	withRegionalVariants,
} from "./regional";
import esMX from "./regional/es-MX.json";

const loaded = {
	"en-US": { translation: enUS },
	"es-ES": { translation: esES },
	"pt-BR": { translation: ptBR },
};
const resources = withRegionalVariants(loaded, { "es-MX": esMX });

describe("regional variants", () => {
	it("merges nested overrides and keeps every other base string", () => {
		expect(
			mergeCatalog(
				{ a: "uno", nested: { b: "dos", c: "tres" } },
				{ nested: { c: "TRES" } },
			),
		).toEqual({ a: "uno", nested: { b: "dos", c: "TRES" } });
	});

	it("builds on the full catalog of the same language", () => {
		expect(regionalBase("es-MX", ["en-US", "es-ES", "pt-BR"])).toBe("es-ES");
		expect(regionalBase("fr-CA", ["en-US", "es-ES"])).toBeUndefined();
	});

	it("lists es-MX right after es-ES", () => {
		expect(Object.keys(resources)).toEqual([
			"en-US",
			"es-ES",
			"es-MX",
			"pt-BR",
		]);
	});

	it("shows es-ES's completeness for es-MX", () => {
		expect(getTranslationProgress("es-MX", resources)).toBe(
			getTranslationProgress("es-ES", resources),
		);
	});

	it("uses overrides and falls back to es-ES for everything else", async () => {
		const i18n = createInstance().use(ICU);
		await i18n.init({
			resources,
			lng: "es-MX",
			fallbackLng: fallbackLanguages,
		});
		expect(i18n.t("settingsDialog.tab.backup")).toBe("Respaldo");
		expect(i18n.t("importLyrics.importSuccess", { count: 2 })).toBe(
			"Se importaron 2 líneas.",
		);
		expect(i18n.t("common.save")).toBe(esES.common.save);
		expect(i18n.resolvedLanguage).toBe("es-MX");
	});

	it("inherits strings es-ES gains later", async () => {
		const i18n = createInstance();
		await i18n.init({
			resources: withRegionalVariants(
				{
					"en-US": {
						translation: { common: { save: "Save", cancel: "Cancel" } },
					},
					"es-ES": {
						translation: { common: { save: "save-ES", cancel: "cancel-ES" } },
					},
				},
				{ "es-MX": { common: { save: "save-MX" } } },
			),
			lng: "es-MX",
			fallbackLng: fallbackLanguages,
		});
		expect(i18n.t("common.save")).toBe("save-MX");
		expect(i18n.t("common.cancel")).toBe("cancel-ES");
	});
});

describe("Spanish detection", () => {
	it.each([
		["es-MX", "es-MX"],
		["es-419", "es-MX"],
		["es-AR", "es-MX"],
		["es-US", "es-MX"],
		["es-ES", "es-ES"],
		["es", "es-ES"],
		["fr-CA", "en-US"],
	])("%s resolves to %s", async (browser, expected) => {
		const i18n = createInstance();
		await i18n.init({
			resources,
			lng: browser,
			fallbackLng: fallbackLanguages,
		});
		expect(i18n.resolvedLanguage).toBe(expected);
	});

	it("falls back to English without a language", () => {
		expect(fallbackLanguages()).toEqual(["en-US"]);
	});
});
