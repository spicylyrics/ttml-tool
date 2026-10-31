import type { LyricLine, TTMLLyric } from "$/types/ttml";

/**
 * Clears the start and end time of the selected words, or of every word in the
 * selected lines when no word is selected. Returns the same document when
 * nothing changes.
 */
export function clearWordTiming(
	document: TTMLLyric,
	wordIds: ReadonlySet<string>,
	lineIds: ReadonlySet<string> = new Set(),
): TTMLLyric {
	const wholeLines = wordIds.size === 0;
	let changed = false;
	const lyricLines = document.lyricLines.map((line): LyricLine => {
		const clearLine = wholeLines && lineIds.has(line.id);
		let lineChanged = false;
		const words = line.words.map((word) => {
			if (!(clearLine || wordIds.has(word.id))) return word;
			if (word.startTime === 0 && word.endTime === 0) return word;
			lineChanged = true;
			return { ...word, startTime: 0, endTime: 0 };
		});
		const lineTimed = line.startTime !== 0 || line.endTime !== 0;
		if (!lineChanged && !(clearLine && lineTimed)) return line;
		changed = true;
		return clearLine
			? { ...line, words, startTime: 0, endTime: 0 }
			: { ...line, words };
	});
	return changed ? { ...document, lyricLines } : document;
}
