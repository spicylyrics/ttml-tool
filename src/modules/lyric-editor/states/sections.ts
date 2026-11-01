import { atom } from "jotai";

/** The section whose divider label is being renamed in place, if any. */
export const editingSectionIdAtom = atom<string | null>(null);

/** The section Apply timings from... was opened on, or null when closed. */
export const applyTimingsSectionIdAtom = atom<string | null>(null);
