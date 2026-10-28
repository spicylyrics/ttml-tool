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
