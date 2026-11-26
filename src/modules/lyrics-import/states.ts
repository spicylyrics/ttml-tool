import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { ImportSourceId } from "$/modules/lyrics-import/components/ImportSourceCards";
import { importLyricsDialogAtom } from "$/states/dialogs.ts";
import { startedAsNewInstall } from "$/utils/has-used-app";
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

const AUTO_PROCESS_KEY = "importLyrics.autoProcess";

/**
 * On for new installs, off for people who already used the app, so their
 * import keeps working the way they know. Decided once, on the first start
 * with this setting.
 */
export function initialAutoProcess(
	storage: Pick<Storage, "getItem" | "setItem">,
	isNewInstall = startedAsNewInstall,
): boolean {
	const stored = storage.getItem(AUTO_PROCESS_KEY);
	if (stored !== null) return stored === "true";
	storage.setItem(AUTO_PROCESS_KEY, JSON.stringify(isNewInstall));
	return isNewInstall;
}

let autoProcessDefault = true;
try {
	if (typeof localStorage !== "undefined")
		autoProcessDefault = initialAutoProcess(localStorage);
} catch {
	// Storage can be blocked; new-user behavior applies.
}

/** Runs Process lyrics on lyrics pasted or fetched into the import box. */
export const autoProcessImportAtom = atomWithStorage(
	AUTO_PROCESS_KEY,
	autoProcessDefault,
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
