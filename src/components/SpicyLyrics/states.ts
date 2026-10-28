import { atomWithStorage } from "jotai/utils";

/** Spicy Lyrics' "Join Split Words": show a word sung in syllables as one word. Off by default, as in Spicy. */
export const spicyJoinSplitWordsAtom = atomWithStorage(
	"spicyJoinSplitWords",
	false,
);
