import type { TTMLLyric } from "$/types/ttml";

const APOSTROPHE_LIKE_CHARACTERS =
	/[`´\u02BB\u02BC\u055A\u2018\u2019\u201A\u201B\u2032\u2035\uFF07]/g;

/** Converts common apostrophe-like characters to the ASCII apostrophe. */
export const normalizeApostrophes = (text: string): string =>
	text.replace(APOSTROPHE_LIKE_CHARACTERS, "'");

/**
 * Converts Cyrillic Е/е only when it is embedded in an otherwise Latin word.
 * This catches hidden lookalikes such as "thе" without changing genuine
 * Cyrillic words such as "привет".
 */
export const normalizeCyrillicEs = (text: string): string =>
	text.replace(/[\p{L}\p{N}]+/gu, (token) => {
		if (!/[Ее]/.test(token) || !/[A-Za-z]/.test(token)) return token;
		return token.replace(/[Ее]/g, (character) =>
			character === "Е" ? "E" : "e",
		);
	});

const normalizeOptionalText = (
	text: string | undefined,
	normalize: (text: string) => string,
): string | undefined => (text === undefined ? undefined : normalize(text));

export interface LyricTextNormalizationOptions {
	normalizeApostrophes: boolean;
	normalizeCyrillicEs: boolean;
}

export const normalizeLyricText = (
	lyrics: TTMLLyric,
	options: LyricTextNormalizationOptions,
): TTMLLyric => {
	if (!options.normalizeApostrophes && !options.normalizeCyrillicEs)
		return lyrics;

	const normalize = (text: string) => {
		let normalized = text;
		if (options.normalizeApostrophes)
			normalized = normalizeApostrophes(normalized);
		if (options.normalizeCyrillicEs)
			normalized = normalizeCyrillicEs(normalized);
		return normalized;
	};

	return {
		...lyrics,
		metadata: lyrics.metadata.map((entry) => ({
			...entry,
			value: entry.value.map(normalize),
		})),
		marks: lyrics.marks?.map((mark) => ({
			...mark,
			label: normalizeOptionalText(mark.label, normalize),
			description: normalizeOptionalText(mark.description, normalize),
		})),
		sections: lyrics.sections?.map((section) => ({
			...section,
			label: normalize(section.label),
		})),
		lyricLines: lyrics.lyricLines.map((line) => ({
			...line,
			translatedLyric: normalize(line.translatedLyric ?? ""),
			romanLyric: normalize(line.romanLyric ?? ""),
			geniusHeader: normalizeOptionalText(line.geniusHeader, normalize),
			words: line.words.map((word) => ({
				...word,
				word: normalize(word.word),
				romanWord: normalize(word.romanWord ?? ""),
			})),
		})),
	};
};

/**
 * Returns imported user-visible text with apostrophe-like characters normalized.
 */
export const normalizeImportedLyricApostrophes = (
	lyrics: TTMLLyric,
	enabled: boolean,
): TTMLLyric => {
	if (!enabled) return lyrics;

	return normalizeLyricText(lyrics, {
		normalizeApostrophes: enabled,
		normalizeCyrillicEs: false,
	});
};

/**
 * Returns imported user-visible text with isolated Cyrillic Е/е lookalikes normalized.
 */
export const normalizeImportedLyricCyrillicEs = (
	lyrics: TTMLLyric,
	enabled: boolean,
): TTMLLyric => {
	if (!enabled) return lyrics;

	return normalizeLyricText(lyrics, {
		normalizeApostrophes: false,
		normalizeCyrillicEs: enabled,
	});
};
