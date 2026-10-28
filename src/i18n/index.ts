import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import { bundledResources, localeBackend } from "./resources";
import { initI18n, startupLanguage } from "./startup-language";

export { waitForStartupLanguage } from "./startup-language";

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
 * Settles once the startup language (plus its fallbacks) is loaded. main.tsx
 * waits for it before the first render (with a timeout, see
 * waitForStartupLanguage), so the first paint is in the user's language.
 */
export const i18nReady = initI18n(
	i18n.use(initReactI18next).use(ICU).use(localeBackend),
	bundledResources,
	startupLanguage(),
	import.meta.env.DEV,
);

export default i18n;
