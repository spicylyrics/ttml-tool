import type { LyricLine } from "$/types/ttml";

/**
 * Spicy Lyrics reads a line-timed TTML as plain lines: background vocals are
 * left out and every line sits on the lead side. The preview shows it the same
 * way. The export still writes them, so nothing is lost.
 */
export function asSpicyLineTimed(lines: LyricLine[]): LyricLine[] {
	return lines
		.filter((line) => !line.isBG)
		.map((line) => (line.isDuet ? { ...line, isDuet: false } : line));
}

/** Whether the song has anything Spicy Lyrics leaves out of line-timed songs. */
export function hasHiddenLineTimedVocals(lines: LyricLine[]): boolean {
	return lines.some((line) => line.isBG || line.isDuet);
}
