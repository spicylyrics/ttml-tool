import { atom } from "jotai";
import { lyricLinesAtom } from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";

/**
 * Flip every line between the main singer and the duet singer, or only the
 * lines in `ids`. Background lines flip with the rest, so they keep following
 * their lead line. Returns the same document when nothing is in scope.
 */
export function swapDuetLines(
	doc: TTMLLyric,
	ids?: ReadonlySet<string>,
): TTMLLyric {
	const inScope = (id: string) => !ids || ids.has(id);
	if (!doc.lyricLines.some((line) => inScope(line.id))) return doc;
	return {
		...doc,
		lyricLines: doc.lyricLines.map((line) =>
			inScope(line.id) ? { ...line, isDuet: !line.isDuet } : line,
		),
	};
}

/** One edit, so one undo step brings every swapped line back. */
export const swapDuetLinesAtom = atom(
	null,
	(get, set, ids?: ReadonlySet<string>) => {
		const doc = get(lyricLinesAtom);
		const next = swapDuetLines(doc, ids);
		if (next !== doc) set(lyricLinesAtom, next);
	},
);
