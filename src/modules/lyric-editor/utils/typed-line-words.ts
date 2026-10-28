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
		const marked = chunk.includes("\\");
		const learned = marked
			? null
			: applyLearnedRule(chunk, learnedRules as Map<string, number[]>);
		const parts = learned ?? splitTextImportWords(chunk, "\\", true);
		words.push(...parts.filter((part) => part.length > 0));
	}
	return words.length > 0 ? words : [text];
}
