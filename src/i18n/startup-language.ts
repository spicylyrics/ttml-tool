import type { i18n as I18n, Resource } from "i18next";
import { fallbackLanguages } from "./regional";

const SOURCE_LANGUAGE = "en-US";

/** How long the first render waits for the startup language's catalog. */
export const STARTUP_LANGUAGE_TIMEOUT_MS = 4000;

/** The saved interface language, or the browser's when none is saved. */
export function startupLanguage(
	storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage,
	browserLanguage: string | undefined = globalThis.navigator?.language,
): string | undefined {
	let stored: string | null = null;
	try {
		stored = storage?.getItem("language") ?? null;
	} catch {}
	return stored || browserLanguage || undefined;
}

/**
 * Initializes in en-US, which is bundled, so i18next is ready right away and
 * the app can always render. Then switches to `language`, loading its catalog
 * (and its fallbacks) through the backend. The returned promise settles when
 * that switch is done; a failed catalog leaves en-US showing.
 */
export function initI18n(
	instance: I18n,
	resources: Resource,
	language: string | undefined,
	debug = false,
): Promise<unknown> {
	return instance
		.init({
			resources,
			// Load languages missing from `resources` through the backend.
			partialBundledLanguages: true,
			lng: SOURCE_LANGUAGE,
			debug,
			fallbackLng: fallbackLanguages,
			interpolation: {
				escapeValue: false,
			},
			returnNull: false,
		})
		.then(() =>
			language && language !== SOURCE_LANGUAGE
				? instance.changeLanguage(language)
				: undefined,
		);
}

/**
 * Waits for `ready`, but at most `timeoutMs`. On timeout the app renders in
 * en-US and the pending switch still applies when (if) its catalog arrives.
 * Never rejects.
 */
export function waitForStartupLanguage(
	ready: Promise<unknown>,
	timeoutMs = STARTUP_LANGUAGE_TIMEOUT_MS,
): Promise<void> {
	return new Promise((resolve) => {
		const timer = setTimeout(() => {
			console.warn(
				`Interface language not loaded after ${timeoutMs} ms; showing English until it arrives.`,
			);
			resolve();
		}, timeoutMs);
		ready
			.catch((error) => {
				console.error("Error loading the interface language:", error);
			})
			.finally(() => {
				clearTimeout(timer);
				resolve();
			});
	});
}
