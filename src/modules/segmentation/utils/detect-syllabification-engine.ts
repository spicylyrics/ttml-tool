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

	const kana =
		text.match(/[\p{Script=Hiragana}\p{Script=Katakana}]/gu)?.length ?? 0;
	if (kana > 0) return "japanese" as const;

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
) => detectSyllabificationEngine(lyricLines) === savedEngine;
