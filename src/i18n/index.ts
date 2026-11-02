import i18n from "i18next";
import ICU from "i18next-icu";
import { initReactI18next } from "react-i18next";
import { PSEUDO_LOCALE, pseudoCatalog } from "./pseudo";
import { fallbackLanguages } from "./regional";
import resources from "./resources";

// Dev builds get a pseudo-locale for overflow testing. It is added to the
// shared resources object, so the language picker lists it too.
if (import.meta.env.DEV) {
	resources[PSEUDO_LOCALE] = {
		translation: pseudoCatalog(resources["en-US"].translation),
	};
}

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

i18n
	.use(initReactI18next)
	.use(ICU)
	.init({
		resources,
		debug: import.meta.env.DEV,
		fallbackLng: fallbackLanguages,
		interpolation: {
			escapeValue: false,
		},
		returnNull: false,
	})
	.then(() =>
		i18n.changeLanguage(localStorage.getItem("language") || navigator.language),
	);

// Keep <html lang> on the interface language, so browsers don't offer to
// translate the page from a language it isn't in.
i18n.on("languageChanged", (language) => {
	document.documentElement.lang = language;
});

export default i18n;
