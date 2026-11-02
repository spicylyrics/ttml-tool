// Regional variants (e.g. es-MX) are not full catalogs. Each one is a small
// file in ./regional holding only the strings that differ from its base
// catalog, so every key added to the base also shows up in the variant.

export type Catalog = { [key: string]: string | Catalog };
type Resources<T> = Record<string, { translation: T }>;

/** Base catalog for a variant: the full catalog with the same language. */
export function regionalBase(
	locale: string,
	catalogs: readonly string[],
): string | undefined {
	const language = locale.split("-")[0];
	return catalogs.find(
		(code) => code !== locale && code.split("-")[0] === language,
	);
}

/** Overrides win; everything else, including later additions, comes from base. */
export function mergeCatalog<T extends Catalog>(
	base: T,
	overrides: Catalog,
): T {
	const merged: Catalog = { ...base };
	for (const [key, value] of Object.entries(overrides)) {
		const current = merged[key];
		merged[key] =
			typeof value === "object" && typeof current === "object"
				? mergeCatalog(current, value)
				: value;
	}
	return merged as T;
}

/**
 * Add each regional variant to the loaded resources, right after its base so
 * the language picker lists them together.
 */
export function withRegionalVariants<T extends Catalog>(
	resources: Resources<T>,
	variants: Record<string, Catalog>,
): Resources<T> {
	const result: Resources<T> = {};
	const codes = Object.keys(resources);
	for (const code of codes) {
		result[code] = resources[code];
		for (const [locale, overrides] of Object.entries(variants)) {
			if (locale in resources || regionalBase(locale, codes) !== code) {
				continue;
			}
			result[locale] = {
				translation: mergeCatalog(resources[code].translation, overrides),
			};
		}
	}
	return result;
}

// Spain's own region codes. Every other Spanish region (es-419, es-AR, es-US,
// ...) is closer to Mexican Spanish than to Spain's.
const SPAIN = new Set(["ES", "EA", "IC"]);

/**
 * i18next fallback chain. Bare "es" and Spain use es-ES; Latin American and
 * US Spanish use es-MX. Everything else falls back to English.
 */
export function fallbackLanguages(code?: string): string[] {
	const [language, region] = (code ?? "").split("-");
	if (language?.toLowerCase() === "es") {
		return region && !SPAIN.has(region.toUpperCase())
			? ["es-MX", "es-ES", "en-US"]
			: ["es-ES", "en-US"];
	}
	return ["en-US"];
}
