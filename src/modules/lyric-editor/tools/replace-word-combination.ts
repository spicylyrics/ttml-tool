import type { LyricLine } from "$/types/ttml";

export interface WordCombinationSelection {
	lineId: string;
	words: { id: string; word: string }[];
}

export function getWordCombinationSelection(
	lines: LyricLine[],
	selectedWordIds: ReadonlySet<string>,
): WordCombinationSelection | null {
	if (selectedWordIds.size < 2) return null;

	for (const line of lines) {
		const firstIndex = line.words.findIndex((word) =>
			selectedWordIds.has(word.id),
		);
		if (firstIndex === -1) continue;

		const words = line.words.slice(
			firstIndex,
			firstIndex + selectedWordIds.size,
		);
		if (
			words.length !== selectedWordIds.size ||
			!words.every((word) => selectedWordIds.has(word.id))
		) {
			return null;
		}

		return {
			lineId: line.id,
			words: words.map(({ id, word }) => ({ id, word })),
		};
	}

	return null;
}

export function replaceWordCombination(
	lines: LyricLine[],
	selection: WordCombinationSelection,
	replacements: string[],
	applyToAll: boolean,
	caseSensitive: boolean,
): number {
	const target = selection.words;
	if (target.length < 2 || replacements.length !== target.length) return 0;

	const sourceLine = lines.find((line) => line.id === selection.lineId);
	const sourceIndex =
		sourceLine?.words.findIndex((word) => word.id === target[0].id) ?? -1;
	if (
		!sourceLine ||
		sourceIndex === -1 ||
		!target.every((word, offset) => {
			const candidate = sourceLine.words[sourceIndex + offset];
			return candidate?.id === word.id && candidate.word === word.word;
		})
	) {
		return 0;
	}

	if (!applyToAll) {
		for (let offset = 0; offset < target.length; offset++) {
			sourceLine.words[sourceIndex + offset].word = replacements[offset];
		}
		return 1;
	}

	const targetText = target.map(({ word }) =>
		caseSensitive ? word : word.toLowerCase(),
	);
	let count = 0;
	for (const line of lines) {
		for (let index = 0; index <= line.words.length - target.length; ) {
			const matches = targetText.every((word, offset) => {
				const candidate = line.words[index + offset].word;
				return (caseSensitive ? candidate : candidate.toLowerCase()) === word;
			});
			if (!matches) {
				index++;
				continue;
			}

			for (let offset = 0; offset < target.length; offset++) {
				line.words[index + offset].word = replacements[offset];
			}
			count++;
			index += target.length;
		}
	}
	return count;
}
