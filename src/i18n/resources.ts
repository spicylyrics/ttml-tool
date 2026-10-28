import type { BackendModule, ReadCallback } from "i18next";
import { importWithReload } from "$/utils/import-with-reload";
import enUS from "./locales/en-US/translation.json";
import { PSEUDO_LOCALE, pseudoCatalog } from "./pseudo";
import {
	type Catalog,
	mergeCatalog,
	regionalBase,
	withRegionalVariants,
} from "./regional";

// en-US is the fallback and the source of every key, so it ships in the entry
// chunk. Every other catalog is its own chunk, loaded when its language is
// used. Chunks are local files, so this works offline and in the desktop app.

export const SOURCE_LANGUAGE = "en-US";

export type Translation = typeof enUS;
type Loader = () => Promise<Catalog>;

// "./locales/fr-FR/translation.json" and "./regional/es-MX.json" both name
// their locale in the last path segment before the file name or extension.
const codeFromPath = (path: string) =>
	path.replace(/\/translation\.json$/, "").replace(/^.*\/|\.json$/g, "");

function byCode<T>(modules: Record<string, T>): Record<string, T> {
	return Object.fromEntries(
		Object.entries(modules).map(([path, value]) => [codeFromPath(path), value]),
	);
}

/** One loader per full catalog (folder name), en-US excluded. */
const catalogLoaders: Record<string, Loader> = byCode(
	import.meta.glob<Catalog>(
		["./locales/*/translation.json", "!./locales/en-US/translation.json"],
		{ import: "default" },
	),
);

/** One JSON file per regional variant, named after its locale (es-MX.json). */
const variants: Record<string, Catalog> = byCode(
	import.meta.glob<Catalog>("./regional/*.json", {
		eager: true,
		import: "default",
	}),
);

/**
 * Every interface language, in picker order: full catalogs alphabetically,
 * each regional variant right after its base.
 */
export function listLanguages(
	catalogCodes: readonly string[],
	variantCodes: readonly string[],
): string[] {
	const codes = [...catalogCodes].sort();
	const result: string[] = [];
	for (const code of codes) {
		result.push(code);
		for (const variant of variantCodes) {
			if (!codes.includes(variant) && regionalBase(variant, codes) === code) {
				result.push(variant);
			}
		}
	}
	return result;
}

export const languages: readonly string[] = [
	...listLanguages(
		[SOURCE_LANGUAGE, ...Object.keys(catalogLoaders)],
		Object.keys(variants),
	),
	// Dev builds get a pseudo-locale for overflow testing.
	...(import.meta.env.DEV ? [PSEUDO_LOCALE] : []),
];

/** Catalogs available without loading anything. */
export const bundledResources: Record<string, { translation: Translation }> = {
	[SOURCE_LANGUAGE]: { translation: enUS },
	...(import.meta.env.DEV
		? { [PSEUDO_LOCALE]: { translation: pseudoCatalog(enUS) } }
		: {}),
};

/**
 * Loads one language's catalog. Regional variants load their base catalog
 * and apply their overrides. Unknown codes (a bare "fr", a stale stored
 * setting) resolve to an empty catalog so i18next falls back to en-US.
 */
export function createCatalogReader(
	loaders: Record<string, Loader>,
	overrides: Record<string, Catalog>,
	load: (loader: Loader) => Promise<Catalog> = (loader) =>
		importWithReload(loader),
) {
	const codes = [SOURCE_LANGUAGE, ...Object.keys(loaders)];
	return async (language: string): Promise<Catalog> => {
		const code = codes.find(
			(candidate) => candidate.toLowerCase() === language.toLowerCase(),
		);
		if (code && loaders[code]) return load(loaders[code]);
		const variant = Object.keys(overrides).find(
			(candidate) => candidate.toLowerCase() === language.toLowerCase(),
		);
		const base = variant && regionalBase(variant, codes);
		if (variant && base && loaders[base]) {
			return mergeCatalog(await load(loaders[base]), overrides[variant]);
		}
		return {};
	};
}

/**
 * i18next backend that reads catalogs from local chunks. A failed chunk
 * rejects, i18next logs it and uses the fallback languages instead.
 */
export function createLocaleBackend(
	read: (language: string) => Promise<Catalog>,
): BackendModule {
	return {
		type: "backend",
		init() {},
		read(language: string, _namespace: string, callback: ReadCallback) {
			read(language).then(
				(catalog) => callback(null, catalog),
				(error: Error) => callback(error, false),
			);
		},
	};
}

export const localeBackend = createLocaleBackend(
	createCatalogReader(catalogLoaders, variants),
);

let progressPromise: Promise<Record<string, number | null>> | undefined;

/**
 * Translation completeness for the language picker. It needs every catalog,
 * so it loads them all the first time Preferences asks, then caches the
 * result. No reload on a stale chunk here: a missing percentage is not worth
 * restarting the app for.
 */
export function loadTranslationProgress(
	progress: (
		code: string,
		resources: Record<string, { translation: Catalog }>,
	) => number | null,
): Promise<Record<string, number | null>> {
	progressPromise ??= Promise.all(
		Object.entries(catalogLoaders).map(
			async ([code, loader]) =>
				[code, { translation: await loader() }] as const,
		),
	).then((loaded) => {
		const resources = withRegionalVariants<Catalog>(
			{
				[SOURCE_LANGUAGE]: { translation: enUS },
				...Object.fromEntries(loaded),
			},
			variants,
		);
		if (import.meta.env.DEV) {
			resources[PSEUDO_LOCALE] = bundledResources[PSEUDO_LOCALE];
		}
		return Object.fromEntries(
			languages.map((code) => [code, progress(code, resources)]),
		);
	});
	progressPromise.catch(() => {
		progressPromise = undefined;
	});
	return progressPromise;
}
