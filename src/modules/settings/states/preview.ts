import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

export enum PreviewModeType {
	Standard = "standard",
	Toxi = "toxi",
	Spicy = "spicy",
	Timing = "timing",
}

export const storedPreviewModeTypeAtom = atomWithStorage<string>(
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
export const spicyForceLineSyncedAtom = atomWithStorage(
	"spicyForceLineSynced",
	false,
);
export type SpicyBackgroundMode = "animated" | "color" | "static";
export const spicyBackgroundModeAtom = atomWithStorage<SpicyBackgroundMode>(
	"spicyBackgroundMode",
	"animated",
);
