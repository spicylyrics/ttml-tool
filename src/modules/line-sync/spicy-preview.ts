import type { LyricLine } from "$/types/ttml";
import { lineText } from "./line-timing";

/**
 * Spicy Lyrics reads a line-timed TTML as plain lines: background vocals are
 * left out and every line sits on the lead side. The preview shows it the same
 * way, each line as its text timed like the line, as the export writes it.
 * The export still writes background and duet lines, so nothing is lost.
 */
export function asSpicyLineTimed(lines: LyricLine[]): LyricLine[] {
	return lines
		.filter((line) => !line.isBG)
		.map((line) => ({
			...line,
			isDuet: false,
			isLineSynced: true,
			words: line.words.length
				? [
						{
							...line.words[0],
							word: lineText(line),
							startTime: line.startTime,
							endTime: line.endTime,
						},
					]
				: [],
		}));
}

/** Whether the song has anything Spicy Lyrics leaves out of line-timed songs. */
export function hasHiddenLineTimedVocals(lines: LyricLine[]): boolean {
	return lines.some((line) => line.isBG || line.isDuet);
}
