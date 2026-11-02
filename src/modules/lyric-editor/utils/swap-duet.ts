import { atom } from "jotai";
import { lyricLinesAtom } from "$/states/main";
import type { LyricLine, TTMLLyric } from "$/types/ttml";

/**
 * Index of the group each line belongs to: a lead line and the background
 * lines right after it share one. A background line with no lead above it
 * starts its own group.
 */
function lineGroups(lines: readonly LyricLine[]): number[] {
	let group = -1;
	return lines.map((line, index) => {
		if (!line.isBG || index === 0) group++;
		return group;
	});
}

/**
 * Flip every line between the main singer and the duet singer, or only the
 * lines in `ids`. A lead line and its background lines always flip together,
 * so picking either one moves the whole group. Returns the same document when
 * nothing is in scope.
 */
export function swapDuetLines(
	doc: TTMLLyric,
	ids?: ReadonlySet<string>,
): TTMLLyric {
	const groups = lineGroups(doc.lyricLines);
	const swapped = new Set<number>();
	doc.lyricLines.forEach((line, index) => {
		if (!ids || ids.has(line.id)) swapped.add(groups[index]);
	});
	if (swapped.size === 0) return doc;
	return {
		...doc,
		lyricLines: doc.lyricLines.map((line, index) =>
			swapped.has(groups[index]) ? { ...line, isDuet: !line.isDuet } : line,
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
