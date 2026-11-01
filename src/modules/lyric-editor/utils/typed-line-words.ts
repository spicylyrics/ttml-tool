import { splitTextImportWords } from "$/modules/project/logic/text-import-words";
import { applyLearnedRule } from "$/modules/segmentation/utils/learned-rules";

/**
 * Split text typed into the "Insert word" field the way the import splits a
 * line: spaces become their own words, `\` marks a split, words break after
 * a hyphen, and a word you split before is split the same way again.
 *
 * The text itself is never changed (no em dashes, no bracket or background
 * handling), so joining the result gives back what was typed, minus any `\`.
 */
export function typedLineToWords(
	text: string,
	learnedRules: ReadonlyMap<string, number[]>,
): string[] {
	if (!text.trim()) return [text];
	const words: string[] = [];
	for (const chunk of text.split(/(\s+)/)) {
		if (!chunk) continue;
		if (/^\s+$/.test(chunk)) {
			words.push(chunk);
			continue;
		}
		if (chunk.includes("\\")) {
			words.push(
				...splitTextImportWords(chunk, "\\", true).filter(
					(part) => part.length > 0,
				),
			);
			continue;
		}
		// Hyphens always split; a learned split then applies to each piece, so
		// a word you taught the splitter still breaks at its dashes.
		for (const piece of splitTextImportWords(chunk, "", true)) {
			if (!piece) continue;
			words.push(
				...(applyLearnedRule(piece, learnedRules as Map<string, number[]>) ?? [
					piece,
				]),
			);
		}
	}
	return words.length > 0 ? words : [text];
}
