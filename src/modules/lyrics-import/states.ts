import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { ImportSourceId } from "$/modules/lyrics-import/components/ImportSourceCards";
import { importLyricsDialogAtom } from "$/states/dialogs.ts";
import {
	DEFAULT_LYRIC_PREP_OPTIONS,
	type LyricPrepOptions,
} from "$/utils/lyric-prep";
import {
	DEFAULT_IMPORT_TEXT_FORMAT,
	type ImportContentMode,
	type ImportLineSeparatorMode,
	type ImportTextFormat,
} from "./logic/import-text";

export const fetchImportedSongwritersAtom = atomWithStorage(
	"importLyrics.fetchSongwriters",
	false,
	undefined,
	{ getOnInit: true },
);

export const importLyricsSourceAtom = atomWithStorage<ImportSourceId>(
	"importLyrics.source",
	"plainText",
	undefined,
	{ getOnInit: true },
);

/** Open the import screen, optionally on a given source. */
export const openImportLyricsAtom = atom(
	null,
	(_get, set, source?: ImportSourceId) => {
		if (source) set(importLyricsSourceAtom, source);
		set(importLyricsDialogAtom, true);
	},
);

/** The import screen's text. Kept outside the dialog so closing it doesn't lose a draft. */
export const importTextAtom = atom("");

/** Open the plain-text import screen with the given text in the box. */
export const openImportWithTextAtom = atom(null, (_get, set, text: string) => {
	set(importTextAtom, text);
	set(openImportLyricsAtom, "plainText");
});

// The text format keys predate the unified screen; keep them so preferences carry over.
const storage = <T>(key: keyof ImportTextFormat, storageKey: string) =>
	atomWithStorage<T>(
		`importFromText.${storageKey}`,
		DEFAULT_IMPORT_TEXT_FORMAT[key] as T,
		undefined,
		{ getOnInit: true },
	);

export const importModeAtom = storage<ImportContentMode>("mode", "importMode");
export const lineSeparatorModeAtom = storage<ImportLineSeparatorMode>(
	"lineSeparatorMode",
	"lineSeparatorMode",
);
export const lineSeparatorAtom = storage<string>(
	"lineSeparator",
	"lineSeparator",
);
export const swapTransAndRomanAtom = storage<boolean>(
	"swapTransAndRoman",
	"swapTransAndRoman",
);
export const wordSeparatorAtom = storage<string>(
	"wordSeparator",
	"wordSeparator",
);
export const enableSpecialPrefixAtom = storage<boolean>(
	"enableSpecialPrefix",
	"enableSpecialPrefix",
);
export const bgLyricPrefixAtom = storage<string>(
	"bgLyricPrefix",
	"bgLyricPrefix",
);
export const duetLyricPrefixAtom = storage<string>(
	"duetLyricPrefix",
	"duetLyricPrefix",
);

const processStepsStorageAtom = atomWithStorage<Partial<LyricPrepOptions>>(
	"importFromText.processSteps",
	{},
	undefined,
	{ getOnInit: true },
);

/** Which Process lyrics steps run. Missing keys keep today's default (on). */
export const processStepsAtom = atom(
	(get): LyricPrepOptions => ({
		...DEFAULT_LYRIC_PREP_OPTIONS,
		...get(processStepsStorageAtom),
	}),
	(get, set, patch: Partial<LyricPrepOptions>) =>
		set(processStepsStorageAtom, { ...get(processStepsStorageAtom), ...patch }),
);

export const processStepsOpenAtom = atomWithStorage(
	"importLyrics.processStepsOpen",
	false,
	undefined,
	{ getOnInit: true },
);

export const importTextFormatAtom = atom(
	(get): ImportTextFormat => ({
		mode: get(importModeAtom),
		lineSeparatorMode: get(lineSeparatorModeAtom),
		lineSeparator: get(lineSeparatorAtom),
		swapTransAndRoman: get(swapTransAndRomanAtom),
		wordSeparator: get(wordSeparatorAtom),
		enableSpecialPrefix: get(enableSpecialPrefixAtom),
		bgLyricPrefix: get(bgLyricPrefixAtom),
		duetLyricPrefix: get(duetLyricPrefixAtom),
	}),
);
