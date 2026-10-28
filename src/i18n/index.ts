import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import { fallbackLanguages } from "./regional";
import { bundledResources, localeBackend } from "./resources";
import { startupLanguage } from "./startup-language";

// The repository is the translation source of truth; en-US defines the keys.
type TranslationResource = typeof import("./locales/en-US/translation.json");

declare module "i18next" {
	interface CustomTypeOptions {
		resources: {
			translation: TranslationResource;
		};
		defaultNS: "translation";
		returnNull: false;
		allowedKeys: keyof TranslationResource;
	}
}

/**
 * Resolves once the startup language (plus its fallbacks) is loaded. main.tsx
 * waits for it before the first render, so the first paint is already in the
 * user's language. It also resolves when a catalog fails to load; i18next then
 * shows en-US.
 */
export const i18nReady = i18n
	.use(initReactI18next)
	.use(ICU)
	.use(localeBackend)
	.init({
		resources: bundledResources,
		// Load languages missing from `resources` through the backend.
		partialBundledLanguages: true,
		lng: startupLanguage(),
		debug: import.meta.env.DEV,
		fallbackLng: fallbackLanguages,
		interpolation: {
			escapeValue: false,
		},
		returnNull: false,
	});

export default i18n;
