/**
 * Apple-style head-level translations for TTML export:
 *
 *   <iTunesMetadata><translations>
 *     <translation xml:lang="en">
 *       <text for="L1">Main line<span ttm:role="x-bg">(Background)</span></text>
 *
 * The parser already reads this layout. Spicy Lyrics reads translations only
 * from inline `x-translation` spans, so inline stays the default.
 */

export interface HeadTranslationEntry {
	main: string;
	backgrounds: string[];
}

export type HeadTranslationMap = Map<string, HeadTranslationEntry>;

export function collectHeadTranslation(
	entries: HeadTranslationMap,
	key: string,
	main: string,
	backgroundLines: ReadonlyArray<{ translatedLyric: string }>,
) {
	const backgrounds = backgroundLines
		.map((line) => line.translatedLyric.trim())
		.filter(Boolean);
	if (!main.trim() && backgrounds.length === 0) return;
	entries.set(key, { main: main.trim(), backgrounds });
}

const ITUNES_NAMESPACE = "http://music.apple.com/lyric-ttml-internal";

/** Adds `<translations>` to the head's last iTunesMetadata block, or a new one. */
export function appendHeadTranslations(
	doc: Document,
	metadataEl: Element,
	entries: HeadTranslationMap,
	language = "en",
) {
	if (entries.size === 0) return;
	const blocks = Array.from(metadataEl.children).filter(
		(child) => child.tagName === "iTunesMetadata",
	);
	let itunesMeta = blocks[blocks.length - 1];
	if (!itunesMeta) {
		itunesMeta = doc.createElement("iTunesMetadata");
		itunesMeta.setAttribute("xmlns", ITUNES_NAMESPACE);
		metadataEl.appendChild(itunesMeta);
	}

	const translations = doc.createElement("translations");
	const translation = doc.createElement("translation");
	translation.setAttribute("xml:lang", language.trim() || "en");
	for (const [key, { main, backgrounds }] of entries) {
		const text = doc.createElement("text");
		text.setAttribute("for", key);
		if (main) text.appendChild(doc.createTextNode(main));
		for (const background of backgrounds) {
			const span = doc.createElement("span");
			span.setAttribute("ttm:role", "x-bg");
			span.appendChild(doc.createTextNode(`(${background})`));
			text.appendChild(span);
		}
		translation.appendChild(text);
	}
	translations.appendChild(translation);
	itunesMeta.insertBefore(translations, itunesMeta.firstChild);
}
