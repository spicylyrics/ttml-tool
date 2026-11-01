import { atom } from "jotai";
import { collapsedSectionIdsAtom, lyricLinesAtom } from "$/states/main";
import { collapseKey } from "../utils/section-system";

/** The section whose divider label is being renamed in place, if any. */
export const editingSectionIdAtom = atom<string | null>(null);

/** The section Apply timings from... was opened on, or null when closed. */
export const applyTimingsSectionIdAtom = atom<string | null>(null);

/** Unfolds whatever is hiding a line (its section, or its unsectioned stretch). */
export const expandToLineAtom = atom(null, (get, set, lineId: string) => {
	const lines = get(lyricLinesAtom).lyricLines;
	const key = collapseKey(
		lines,
		lines.findIndex((line) => line.id === lineId),
	);
	const collapsed = get(collapsedSectionIdsAtom);
	if (!key || !collapsed.has(key)) return;
	const expanded = new Set(collapsed);
	expanded.delete(key);
	set(collapsedSectionIdsAtom, expanded);
});
