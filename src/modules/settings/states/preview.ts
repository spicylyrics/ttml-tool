import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export enum PreviewModeType {
	Standard = "standard",
	Toxi = "toxi",
	Spicy = "spicy",
	Timing = "timing",
}

const storedPreviewModeTypeAtom = atomWithStorage<string>(
	"previewModeType",
	PreviewModeType.Spicy,
	undefined,
	{ getOnInit: true },
);

export const previewModeTypeAtom = atom(
	(get) => normalizePreviewMode(get(storedPreviewModeTypeAtom)),
	(_get, set, mode: PreviewModeType) => set(storedPreviewModeTypeAtom, mode),
);

export function normalizePreviewMode(value: string): PreviewModeType {
	switch (value) {
		case PreviewModeType.Standard:
		case PreviewModeType.Toxi:
		case PreviewModeType.Spicy:
		case PreviewModeType.Timing:
			return value;
		default:
			return PreviewModeType.Spicy;
	}
}

export const showTranslationLinesAtom = atomWithStorage(
	"showTranslationLines",
	false,
);
export const showRomanLinesAtom = atomWithStorage("showRomanLines", false);
export const lyricWordFadeWidthAtom = atomWithStorage(
	"lyricWordFadeWidth",
	0.5,
);
/**
 * Draws the Spicy preview this many ms ahead of the sound (negative: behind).
 * The Spicy Lyrics extension runs about 100ms ahead of the player position, so
 * +100 makes the preview look like it. Only the preview moves; audio, the
 * spectrogram and exported timings do not.
 */
export const spicyPreviewOffsetAtom = atomWithStorage("spicyPreviewOffset", 0);
export const vsyncAtom = atomWithStorage("vsync", false);
export const showFpsCounterAtom = atomWithStorage("showFpsCounter", false);
export const instantHighlightFadeAtom = atomWithStorage(
	"instantHighlightFade",
	true,
);
export const spicySimpleLyricsModeAtom = atomWithStorage(
	"spicySimpleLyricsMode",
	false,
);
/** Spicy Lyrics' "Join Split Words": show a word sung in syllables as one word. Off by default, as in Spicy. */
export const spicyJoinSplitWordsAtom = atomWithStorage(
	"spicyJoinSplitWords",
	false,
	undefined,
	{ getOnInit: true },
);
export type SpicyBackgroundMode = "animated" | "color" | "static";
export const spicyBackgroundModeAtom = atomWithStorage<SpicyBackgroundMode>(
	"spicyBackgroundMode",
	"animated",
);
