import type { LyricLine } from "$/types/ttml";

/**
 * Word timings the Spicy preview hides or plays wrong:
 * - `untimed`: a sung word with no timing (0 to 0) in a timed line. It shows
 *   as already sung the moment its line starts.
 * - `endsBeforeStart`: end earlier than start. The renderer drops the word.
 * - `startsBeforeLine` / `endsAfterLine`: outside its line's window. A word
 *   follows its line's state until the line is active, so it jumps to filled
 *   when the line starts, or never fills until the line ends.
 */
export type WordTimingProblem =
	| "untimed"
	| "endsBeforeStart"
	| "startsBeforeLine"
	| "endsAfterLine";

export interface WordTimingIssue {
	lineId: string;
	wordId: string;
	problems: WordTimingProblem[];
}

const isTimed = (start: number, end: number) =>
	Number.isFinite(start) && Number.isFinite(end) && !(start === 0 && end === 0);

/**
 * Standalone check behind the preview's "show timing problems" flag. Kept
 * separate so a linter rule can replace it later without touching the preview.
 *
 * Lines without timing, line-synced lines (their words carry no timing) and
 * lines the preview skips (end not after start) are ignored. Whitespace-only
 * words are the editor's untimed space nodes, never problems.
 *
 * Background lines only get the per-word checks: their span is derived from
 * their words, both in the preview and in the exported TTML, so a word cannot
 * sit outside it.
 */
export function detectWordTimingProblems(
	lines: readonly LyricLine[],
): WordTimingIssue[] {
	const issues: WordTimingIssue[] = [];
	for (const line of lines) {
		if (line.isLineSynced) continue;
		if (!isTimed(line.startTime, line.endTime)) continue;
		if (line.endTime <= line.startTime) continue;
		for (const word of line.words) {
			if (word.word.trim().length === 0) continue;
			const problems: WordTimingProblem[] = [];
			if (!isTimed(word.startTime, word.endTime)) problems.push("untimed");
			else if (word.endTime < word.startTime) problems.push("endsBeforeStart");
			else if (!line.isBG) {
				if (word.startTime < line.startTime) problems.push("startsBeforeLine");
				if (word.endTime > line.endTime) problems.push("endsAfterLine");
			}
			if (problems.length > 0)
				issues.push({ lineId: line.id, wordId: word.id, problems });
		}
	}
	return issues;
}
