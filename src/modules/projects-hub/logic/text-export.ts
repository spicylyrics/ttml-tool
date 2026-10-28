import {
	linesToTranscript,
	toGeniusText,
	toPlainText,
} from "$/modules/transcription/logic/transcript-export";
import type { TTMLLyric } from "$/types/ttml";

/**
 * The editor's lyrics as text: one row per line, background vocals in
 * parentheses after the line they back, a blank row between sections.
 * `genius` adds `[Verse 1]`-style headers from the sections.
 */
export function lyricToText(
	lyric: Pick<TTMLLyric, "lyricLines" | "sections">,
	format: "plain" | "genius",
): string {
	const transcript = linesToTranscript(lyric.lyricLines, lyric.sections ?? []);
	return format === "genius"
		? toGeniusText(transcript)
		: toPlainText(transcript);
}

/** `Song.ttml` → `Song.txt`; falls back to `lyrics.txt`. */
export function textFileName(saveFileName: string): string {
	const base = saveFileName.replace(/\.[^./\\]*$/, "").trim();
	return `${base || "lyrics"}.txt`;
}
