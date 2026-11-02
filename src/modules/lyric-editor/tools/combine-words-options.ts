import { atomWithStorage } from "jotai/utils";

export const combineWordsApplyToAllAtom = atomWithStorage(
	"lyricEditor.combineWords.applyToAll",
	false,
);

export const combineWordsIgnoreCaseAtom = atomWithStorage(
	"lyricEditor.combineWords.ignoreCase",
	true,
);

/** Off by default, like Combine, so "you," and "You" get the same romanization. */
export const replaceRomanizationMatchCaseAtom = atomWithStorage(
	"lyricEditor.replaceRomanization.matchCase",
	false,
);
