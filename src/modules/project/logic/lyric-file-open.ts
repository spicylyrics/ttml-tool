import {
	type LyricLine,
	parseEslrc,
	parseLys,
	parseQrc,
	parseYrc,
} from "@applemusic-like-lyrics/lyric";
import { uid } from "uid";
import type { TTMLLyric } from "$/types/ttml";
import { parseLrc } from "$/utils/parse-lrc";
import { parseLyric as parseTTML } from "./ttml-parser";

const LYRIC_PARSERS = new Map<string, (text: string) => LyricLine[]>([
	["lrc", parseLrc],
	["eslrc", parseEslrc],
	["qrc", parseQrc],
	["yrc", parseYrc],
	["lys", parseLys],
]);

export type ParsedLyricFile =
	| { kind: "ok"; lyric: TTMLLyric }
	/** Not a lyric format we read (a stray `package.json`, a PDF, ...). */
	| { kind: "unsupported" }
	/** Read fine but holds no lyric lines: broken XML, or a file that isn't lyrics. */
	| { kind: "empty" };

function toDocument(lyricLines: LyricLine[]): TTMLLyric {
	return {
		lyricLines: lyricLines.map((line) => ({
			...line,
			words: line.words.map((word) => ({
				...word,
				id: uid(),
				obscene: false,
			})),
			ignoreSync: false,
			id: uid(),
		})),
		metadata: [],
	};
}

/**
 * Parses a lyric file's text without touching the editor, so a file that
 * holds no lyrics can be refused before it replaces the open document.
 */
export function parseLyricFile(text: string, ext: string): ParsedLyricFile {
	let lyric: TTMLLyric;
	if (ext === "ttml") {
		lyric = parseTTML(text);
	} else {
		const parse = LYRIC_PARSERS.get(ext);
		if (!parse) return { kind: "unsupported" };
		lyric = toDocument(parse(text));
	}
	if (lyric.lyricLines.length === 0) return { kind: "empty" };
	return { kind: "ok", lyric };
}
