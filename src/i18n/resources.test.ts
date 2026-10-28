import { createInstance } from "i18next";
import ICU from "i18next-icu";
import { describe, expect, it, vi } from "vitest";
import { getTranslationProgress } from "$/modules/settings/modals/common/language";
import { importWithReload } from "$/utils/import-with-reload";
import enUS from "./locales/en-US/translation.json";
import esES from "./locales/es-ES/translation.json";
import frFR from "./locales/fr-FR/translation.json";
import plPL from "./locales/pl-PL/translation.json";
import { fallbackLanguages } from "./regional";
import esMX from "./regional/es-MX.json";
import {
	type createCatalogReader as CreateCatalogReader,
	createCatalogReader,
	createLocaleBackend,
	languages,
	listLanguages,
	loadTranslationProgress,
} from "./resources";
import { startupLanguage } from "./startup-language";

vi.mock("$/utils/import-with-reload", () => ({
	importWithReload: vi.fn((factory: () => Promise<unknown>) => factory()),
}));

type Loaders = Parameters<typeof CreateCatalogReader>[0];

function fakeLoaders() {
	return {
		"es-ES": vi.fn(async () => esES),
		"fr-FR": vi.fn(async () => frFR),
		"pl-PL": vi.fn(async () => plPL),
	} satisfies Loaders;
}

async function startI18n(lng: string | undefined, loaders: Loaders) {
	const i18n = createInstance()
		.use(ICU)
		.use(createLocaleBackend(createCatalogReader(loaders, { "es-MX": esMX })));
	await i18n.init({
		resources: { "en-US": { translation: enUS } },
		partialBundledLanguages: true,
		lng,
		fallbackLng: fallbackLanguages,
		interpolation: { escapeValue: false },
	});
	return i18n;
}

describe("startup language", () => {
	it("prefers the saved setting over the browser language", () => {
		const storage = { getItem: () => "pl-PL" };
		expect(startupLanguage(storage, "fr-FR")).toBe("pl-PL");
	});

	it("uses the browser language when nothing is saved", () => {
		expect(startupLanguage({ getItem: () => null }, "fr-FR")).toBe("fr-FR");
	});

	it("survives storage that throws", () => {
		const storage = {
			getItem: () => {
				throw new Error("blocked");
			},
		};
		expect(startupLanguage(storage, "fr-FR")).toBe("fr-FR");
	});
});

describe("lazy catalogs", () => {
	it("loads nothing for en-US", async () => {
		const loaders = fakeLoaders();
		const i18n = await startI18n("en-US", loaders);
		expect(i18n.resolvedLanguage).toBe("en-US");
		expect(i18n.t("common.save")).toBe(enUS.common.save);
		for (const loader of Object.values(loaders)) {
			expect(loader).not.toHaveBeenCalled();
		}
	});

	it("loads only the stored language before startup resolves", async () => {
		const loaders = fakeLoaders();
		const i18n = await startI18n("fr-FR", loaders);
		expect(i18n.resolvedLanguage).toBe("fr-FR");
		expect(i18n.t("common.save")).toBe(frFR.common.save);
		expect(loaders["fr-FR"]).toHaveBeenCalledTimes(1);
		expect(loaders["pl-PL"]).not.toHaveBeenCalled();
		expect(loaders["es-ES"]).not.toHaveBeenCalled();
	});

	it("matches the code case-insensitively", async () => {
		const i18n = await startI18n("fr-fr", fakeLoaders());
		expect(i18n.t("common.save")).toBe(frFR.common.save);
	});

	it("builds es-MX from es-ES plus its overrides", async () => {
		const loaders = fakeLoaders();
		const i18n = await startI18n("es-MX", loaders);
		expect(i18n.resolvedLanguage).toBe("es-MX");
		expect(i18n.t("settingsDialog.tab.backup")).toBe("Respaldo");
		expect(i18n.t("common.save")).toBe(esES.common.save);
		expect(loaders["fr-FR"]).not.toHaveBeenCalled();
	});

	it("detects Latin American Spanish as es-MX", async () => {
		const i18n = await startI18n("es-AR", fakeLoaders());
		expect(i18n.resolvedLanguage).toBe("es-MX");
	});

	it("shows en-US for a language without a catalog", async () => {
		const i18n = await startI18n("xx-XX", fakeLoaders());
		expect(i18n.resolvedLanguage).toBe("en-US");
		expect(i18n.t("common.save")).toBe(enUS.common.save);
	});

	it("loads the new catalog when the language is switched", async () => {
		const loaders = fakeLoaders();
		const i18n = await startI18n("en-US", loaders);
		await i18n.changeLanguage("pl-PL");
		expect(loaders["pl-PL"]).toHaveBeenCalledTimes(1);
		expect(i18n.resolvedLanguage).toBe("pl-PL");
		expect(i18n.t("common.save")).toBe(plPL.common.save);
	});

	it("falls back to en-US when a catalog chunk fails", async () => {
		const loaders = {
			...fakeLoaders(),
			"fr-FR": vi.fn(async (): Promise<typeof frFR> => {
				throw new Error("chunk missing");
			}),
		};
		const i18n = await startI18n("fr-FR", loaders);
		expect(i18n.resolvedLanguage).toBe("en-US");
		expect(i18n.t("common.save")).toBe(enUS.common.save);
	});

	it("loads chunks through the stale-chunk reload helper", async () => {
		vi.mocked(importWithReload).mockClear();
		const read = createCatalogReader(fakeLoaders(), {});
		await read("pl-PL");
		expect(importWithReload).toHaveBeenCalledTimes(1);
	});
});

describe("language list", () => {
	it("puts each regional variant right after its base", () => {
		expect(
			listLanguages(["pt-BR", "en-US", "es-ES"], ["es-MX", "fr-CA"]),
		).toEqual(["en-US", "es-ES", "es-MX", "pt-BR"]);
	});

	it("lists every catalog folder and es-MX", () => {
		expect(languages).toContain("en-US");
		expect(languages).toContain("zh-CN");
		expect(languages.indexOf("es-MX")).toBe(languages.indexOf("es-ES") + 1);
	});

	it("computes completeness for every language", async () => {
		const progress = await loadTranslationProgress(getTranslationProgress);
		expect(Object.keys(progress)).toEqual([...languages]);
		expect(progress["en-US"]).toBeNull();
		expect(progress["es-MX"]).toBe(progress["es-ES"]);
		expect(typeof progress["fr-FR"]).toBe("number");
	});
});
