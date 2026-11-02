import type { LyricLine, LyricWord, TTMLLyric } from "$/types/ttml";

type LegacyWord = LyricWord & { ruby?: unknown };
const normalizedLines = new WeakMap<LyricLine, LyricLine>();

/** Drop ruby readings that older documents and autosaves may still carry. */
export function normalizeDocumentWords(lyric: TTMLLyric): TTMLLyric {
	let changed = false;
	const lyricLines = lyric.lyricLines.map((line) => {
		let normalized = normalizedLines.get(line);
		if (!normalized) {
			let wordsChanged = false;
			const words = line.words.map((word) => {
				if (!("ruby" in word)) return word;
				wordsChanged = true;
				const { ruby: _ruby, ...rest } = word as LegacyWord;
				return rest;
			});
			normalized = wordsChanged ? { ...line, words } : line;
			normalizedLines.set(line, normalized);
		}
		changed ||= normalized !== line;
		return normalized;
	});
	return changed ? { ...lyric, lyricLines } : lyric;
}
