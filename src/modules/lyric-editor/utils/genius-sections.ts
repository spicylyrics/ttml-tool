import type { LyricLine } from "$/types/ttml.ts";
import { getSectionHeader } from "./section-system.ts";

/** Returns a normalized, display-ready Genius section label, if this is one. */
export function getGeniusHeader(value: string): string | undefined {
	return getSectionHeader(value);
}

export function getSectionBounds(lines: LyricLine[], lineIndex: number) {
	const target = lines[lineIndex];
	const key = target?.sectionId ?? target?.geniusHeader;
	if (!key) return undefined;

	let start = lineIndex;
	while (
		start > 0 &&
		(lines[start - 1].sectionId ?? lines[start - 1].geniusHeader) === key
	)
		start--;

	let end = lineIndex + 1;
	while (
		end < lines.length &&
		(lines[end].sectionId ?? lines[end].geniusHeader) === key
	)
		end++;

	return {
		header: target.geniusHeader,
		sectionId: target.sectionId,
		start,
		end,
	};
}

export function shiftSectionToTime(
	lines: LyricLine[],
	lineIndex: number,
	targetStartTime: number,
) {
	const section = getSectionBounds(lines, lineIndex);
	if (!section) return false;
	const sectionLines = lines.slice(section.start, section.end);
	// Untimed lines and words (0/0) stay untimed, and the offset is measured
	// from the first timed line, not from a leading untimed one.
	const isTimed = (item: { startTime: number; endTime: number }) =>
		item.startTime > 0 || item.endTime > 0;
	const firstTimed = sectionLines.find(isTimed);
	if (!firstTimed) return false;
	const offset = targetStartTime - firstTimed.startTime;

	for (const line of sectionLines) {
		if (isTimed(line)) {
			line.startTime += offset;
			line.endTime += offset;
		}
		for (const word of line.words) {
			if (!isTimed(word)) continue;
			word.startTime += offset;
			word.endTime += offset;
		}
	}
	return true;
}
