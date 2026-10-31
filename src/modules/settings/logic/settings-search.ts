export const settingsSearchKeywords: Record<string, string> = {
	common:
		"interface language privacy display discord presence compact background vocals sync",
	editing:
		"edit mode ribbon advanced controls translation romanization per word line field",
	syncing:
		"sync timing timestamp judgment keybinding trigger offset commit smart last word upcoming highlight threshold color wrap scroll focus spectrogram hover tab position glow manual double click background line touch panel skip separate pass inline sync with main skip while syncing background vocals romanization",
	preview:
		"preview fps vsync fade rendering romanization translation simple lyrics line synced background instant auto scroll",
	files:
		"import export cleanup normalize apostrophes cyrillic folder project storage preview files consecutive standalone background vocals",
	backup:
		"autosave interval snapshots history backup restore export import storage",
	audio:
		"music volume playback speed equalizer gain preset mp3 flac conversion spectrogram palette frequency",
	keybinding:
		"keyboard keys shortcut controls new open save undo redo select delete mode sync playback seek volume segment audition",
	appearance:
		"theme preset custom accent color background blur glass intensity image gradient font interface scale reset layout titlebar sidebar editor chip spacing padding romanization translation scrollbar dialog shadow selection spicy lyrics design dark lavender geist classic visual effects lighter performance smooth lag linux",
	changelog: "changelog release notes what's new changed fixed history",
	about: "version update credits license",
};

/** Lowercases and drops accents, so "edicion" finds "Edición". */
function foldSearchText(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

export function matchesSettingsSearch(text: string, query: string): boolean {
	const tokens = foldSearchText(query).trim().split(/\s+/).filter(Boolean);
	const normalizedText = foldSearchText(text);
	return tokens.every((token) => normalizedText.includes(token));
}

/**
 * A page matches on its sidebar label, its English keywords, or the text it
 * renders (labels and descriptions in the current language). The keywords
 * stay as a fallback for rows a page only renders in some modes.
 */
export function matchesSettingsPage(
	page: { label: string; keywords: string; text?: string },
	query: string,
): boolean {
	return (
		matchesSettingsSearch(`${page.label} ${page.keywords}`, query) ||
		(page.text !== undefined && matchesSettingsSearch(page.text, query))
	);
}
