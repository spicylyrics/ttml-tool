import { atomWithStorage } from "jotai/utils";

/**
 * Tighter Toxi layout with easier-to-read background lines. Off by default
 * until it has been checked by hand; the classic Toxi look stays the default.
 */
export const toxiTightLayoutAtom = atomWithStorage("toxiTightLayout", false);
