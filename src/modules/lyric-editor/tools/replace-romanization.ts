import { getLearnedWordParts } from "$/modules/segmentation/utils/learned-rules";

interface RomanizableWord {
	word: string;
	romanWord: string;
}

interface RomanizableLine {
	words: RomanizableWord[];
}

export interface ReplaceRomanizationOptions {
	lineIndex: number;
	wordIndex: number;
	targetWord: string;
	replacement: string;
	applyToAll: boolean;
	caseSensitive: boolean;
}

export const replaceRomanization = (
	lines: RomanizableLine[],
	options: ReplaceRomanizationOptions,
) => {
	const {
		lineIndex,
		wordIndex,
		targetWord,
		replacement,
		applyToAll,
		caseSensitive,
	} = options;

	if (!applyToAll) {
		const target = lines[lineIndex]?.words[wordIndex];
		if (target?.word === targetWord) target.romanWord = replacement;
		return;
	}

	// Like Combine: unless case matters, compare words without their edge
	// punctuation, so "you," gets the same romanization as "You".
	const targetKey = cleanWordKey(targetWord);
	for (const line of lines) {
		for (const word of line.words) {
			const matches = caseSensitive
				? word.word === targetWord
				: cleanWordKey(word.word) === targetKey;
			if (matches) word.romanWord = replacement;
		}
	}
};

const cleanWordKey = (word: string) =>
	getLearnedWordParts(word)?.key ?? word.toLocaleLowerCase();
