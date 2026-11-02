import { franc } from "franc-min";
import type { LyricLine } from "$/types/ttml";
import type { SegmentationEngineId } from "../types";

const engineForLanguage: Record<string, SegmentationEngineId> = {
	eng: "prosodic",
	spa: "silabas",
	fra: "syllabify-fr",
	deu: "hyphenation-de",
	ind: "hyphenation-id",
	ita: "hyphenation-it",
	pol: "hyphenation-pl",
	por: "hyphenation-pt",
	rus: "syllabify",
};

const extractLyricsText = (lyricLines: LyricLine[]) =>
	lyricLines
		.flatMap((line) => line.words.map(({ word }) => word))
		.join(" ")
		.trim();

/** Suggests the best available engine without changing the saved preference. */
export const detectSyllabificationEngine = (lyricLines: LyricLine[]) => {
	const text = extractLyricsText(lyricLines);
	if (!text) return undefined;

	// Japanese splits by sound whatever the engine, which then only handles
	// the song's English words: judge those alone.
	const kana =
		text.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0;
	if (kana > 0) {
		const latin = text.replace(/[^\p{Script=Latin}\s']/gu, " ").trim();
		return engineForLanguage[franc(latin, { minLength: 20 })];
	}

	const cyrillic = text.match(/\p{Script=Cyrillic}/gu)?.length ?? 0;
	if (cyrillic > 0) return "syllabify" as const;

	const han = text.match(/\p{Script=Han}/gu)?.length ?? 0;
	if (han > 0) return "basic" as const;

	const detectedLanguage = franc(text, { minLength: 20 });
	return engineForLanguage[detectedLanguage];
};

export const matchesSavedSyllabificationEngine = (
	lyricLines: LyricLine[],
	savedEngine: SegmentationEngineId,
) => {
	const detected = detectSyllabificationEngine(lyricLines);
	// A Japanese song with too little English to judge is fine either way.
	if (
		!detected &&
		/[\p{Script=Hiragana}\p{Script=Katakana}]/u.test(
			extractLyricsText(lyricLines),
		)
	)
		return true;
	return detected === savedEngine;
};
