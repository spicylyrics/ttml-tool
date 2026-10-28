/** Page ids of the classic Preferences dialog, which deep links still use. */
export type ClassicPageId =
	| "common"
	| "editor"
	| "files"
	| "audio"
	| "keybinding"
	| "appearance"
	| "about";

export type ShellPageId =
	| "common"
	| "appearance"
	| "editing"
	| "syncing"
	| "preview"
	| "audio"
	| "files"
	| "backup"
	| "keybinding"
	| "experimental"
	| "about";

/** A block of settings as the classic pages render it, kept whole. */
export type SectionId =
	| "display"
	| "privacy"
	| "syncing"
	| "playbackBehavior"
	| "editMode"
	| "timeModeDisplay"
	| "syncAids"
	| "preview"
	| "previewPerformance"
	| "importCleanup"
	| "projects"
	| "autosave"
	| "backup"
	| "playback"
	| "equalizer"
	| "spectrogram"
	| "keyboardView"
	| "keyBindings"
	| "appearance"
	| "about";

/**
 * What each classic page renders, in its order. Feature flag rows aren't
 * listed: they are in `EXPERIMENTAL_FLAGS` and show on the Experimental page.
 */
export const CLASSIC_SECTIONS: Record<ClassicPageId, readonly SectionId[]> = {
	common: ["display", "privacy"],
	editor: [
		"syncing",
		"playbackBehavior",
		"editMode",
		"timeModeDisplay",
		"syncAids",
		"preview",
		"previewPerformance",
	],
	files: ["importCleanup", "projects", "autosave", "backup"],
	audio: ["playback", "equalizer", "spectrogram"],
	keybinding: ["keyboardView", "keyBindings"],
	appearance: ["appearance"],
	about: ["about"],
};

export interface ShellPageEntry {
	value: ShellPageId;
	/** The classic page to open when the shell is turned off on this page. */
	classic: ClassicPageId;
	sections: readonly SectionId[];
	/** English fallback words for search, for rows a page shows only in some modes. */
	keywords: string;
}

/**
 * The shell's pages, in sidebar order. Moving a section is moving its id here.
 * The keywords split the classic pages' keyword lists by where rows went.
 */
export const SHELL_PAGE_MAP: readonly ShellPageEntry[] = [
	{
		value: "common",
		classic: "common",
		sections: ["display", "privacy"],
		keywords:
			"interface language privacy display discord presence compact background vocals sync",
	},
	{
		value: "appearance",
		classic: "appearance",
		sections: ["appearance"],
		keywords:
			"theme preset custom accent color background blur glass intensity image gradient font interface scale reset layout titlebar sidebar editor chip spacing padding romanization translation scrollbar dialog shadow selection spicy lyrics design dark lavender geist classic",
	},
	{
		value: "editing",
		classic: "editor",
		sections: ["editMode"],
		keywords:
			"edit mode ribbon advanced controls translation romanization per word line field",
	},
	{
		value: "syncing",
		classic: "editor",
		sections: ["syncing", "playbackBehavior", "timeModeDisplay", "syncAids"],
		keywords:
			"sync timing timestamp judgment keybinding trigger offset commit smart last word upcoming highlight threshold color wrap scroll focus spectrogram hover tab position glow manual double click background line touch panel skip separate pass inline sync with main skip while syncing background vocals romanization",
	},
	{
		value: "preview",
		classic: "editor",
		sections: ["preview", "previewPerformance"],
		keywords:
			"preview fps vsync fade rendering romanization translation simple lyrics line synced background instant auto scroll",
	},
	{
		value: "audio",
		classic: "audio",
		sections: ["playback", "equalizer", "spectrogram"],
		keywords:
			"music volume playback speed equalizer gain preset mp3 flac conversion spectrogram palette frequency",
	},
	{
		value: "files",
		classic: "files",
		sections: ["importCleanup", "projects"],
		keywords:
			"import export cleanup normalize apostrophes cyrillic folder project storage preview files consecutive standalone background vocals",
	},
	{
		value: "backup",
		classic: "files",
		sections: ["autosave", "backup"],
		keywords:
			"autosave interval snapshots history backup restore export import storage",
	},
	{
		value: "keybinding",
		classic: "keybinding",
		sections: ["keyboardView", "keyBindings"],
		keywords:
			"keyboard keys shortcut controls new open save undo redo select delete mode sync playback seek volume segment audition",
	},
	{
		value: "experimental",
		classic: "common",
		sections: [],
		keywords: "experimental feature flag beta preview new layout",
	},
	{
		value: "about",
		classic: "about",
		sections: ["about"],
		keywords: "version update credits license",
	},
];

/**
 * Classic ids that name a page the shell split or renamed. The rest are shell
 * ids too. Old tab ids (assistant, ai, dev) lived on General.
 */
const CLASSIC_ALIASES: Record<string, ShellPageId> = {
	editor: "syncing",
	assistant: "common",
	ai: "common",
	dev: "common",
};

/** The shell page to show for a tab id set by either dialog or a deep link. */
export function resolveShellPage(tab: string): ShellPageId {
	const page = SHELL_PAGE_MAP.find((entry) => entry.value === tab);
	return page?.value ?? CLASSIC_ALIASES[tab] ?? "common";
}

/** The classic page closest to a shell page, for switching the shell off. */
export function toClassicPage(tab: string): string {
	return (
		SHELL_PAGE_MAP.find((entry) => entry.value === resolveShellPage(tab))
			?.classic ?? tab
	);
}
