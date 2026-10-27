import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { JapaneseGranularity } from "$/modules/segmentation/utils/japanese-split";

/**
 * Feature flag for the Japanese, romanization and translation tools: the
 * rule-based English splitter, Japanese split granularity, pasting a
 * romanized lyric page, and the head-level translation export. Off by
 * default; with it off the app behaves as before.
 */
export const romanizationToolsFlagAtom = atomWithStorage(
	"experimental.romanizationTools",
	false,
);

export const japaneseGranularitySettingAtom =
	atomWithStorage<JapaneseGranularity>(
		"romanization.japaneseGranularity",
		"syllable",
	);

export type TranslationExportFormat = "inline" | "head";

/** Where translations go on export. Inline is what Spicy Lyrics reads. */
export const translationExportFormatSettingAtom =
	atomWithStorage<TranslationExportFormat>(
		"romanization.translationExportFormat",
		"inline",
	);

/** `xml:lang` of head-level translations. */
export const translationLanguageSettingAtom = atomWithStorage(
	"romanization.translationLanguage",
	"en",
);

/** The export format that applies right now: always inline with the flag off. */
export const effectiveTranslationExportFormatAtom = atom((get) =>
	get(romanizationToolsFlagAtom)
		? get(translationExportFormatSettingAtom)
		: "inline",
);

/** The Japanese granularity in effect, or undefined for the existing splitter. */
export const effectiveJapaneseGranularityAtom = atom((get) =>
	get(romanizationToolsFlagAtom)
		? get(japaneseGranularitySettingAtom)
		: undefined,
);

export const pasteRomanizationDialogAtom = atom(false);
