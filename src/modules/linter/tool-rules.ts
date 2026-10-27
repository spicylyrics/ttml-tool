import { shouldExportAsLineSynced } from "$/modules/project/logic/ttml-writer";
import type { LyricLine } from "$/types/ttml";
import { isEnglishLyric } from "./guide-spelling";
import type { LintProblem } from "./lint";

/*
 * Tool-only hints taken from the ttml-review checker (TX24, 2026-10-27).
 * The bot doesn't run these, so they carry their own rule ids.
 */
export const WORD_GAP_RULE = "word-gap";
export const SPOKEN_NUMBER_RULE = "spoken-number";
export const DECORATIVE_SYMBOL_RULE = "decorative-symbol";

// Gaps this small come from setting every boundary by hand, not from a pause.
const MIN_GAP_MS = 1;
const MAX_GAP_MS = 30;

const SYMBOLS = /[™®★☆♥♡♪♫]/u;
const NUMBER_RUN = /\d+(?:[:/.,-]\d+)*/g;

const lineText = (line: LyricLine) =>
	line.words
		.map((word) => word.word)
		.join("")
		.replace(/\s+/g, " ")
		.trim();

function hint(
	rule: string,
	line: LyricLine,
	index: number,
	message: string,
	i18n: LintProblem["i18n"],
	wordIds: string[] = [],
	timeMs = line.startTime,
): LintProblem {
	return {
		key: `${rule}:${index}:${line.id}`,
		severity: "hint",
		rule,
		message,
		i18n,
		lineId: line.id,
		wordIds,
		timeMs,
		loud: false,
	};
}

/** Continuous words should share a boundary timestamp. */
function wordGaps(lines: LyricLine[]): LintProblem[] {
	const out: LintProblem[] = [];
	for (const line of lines) {
		if (shouldExportAsLineSynced(line)) continue;
		const words = line.words.filter((word) => word.word.trim());
		for (let i = 1; i < words.length; i++) {
			const gap = words[i].startTime - words[i - 1].endTime;
			if (gap <= MIN_GAP_MS || gap >= MAX_GAP_MS) continue;
			const word = words[i].word.trim();
			const ms = String(Math.round(gap));
			out.push(
				hint(
					WORD_GAP_RULE,
					line,
					out.length,
					`${ms} ms gap before "${word}": continuous words should share a timestamp. Keep it only if it's a real pause.`,
					{ key: "linter.wordGap", params: { gap: ms, word } },
					[words[i - 1].id, words[i].id],
					words[i - 1].endTime,
				),
			);
		}
	}
	return out;
}

/** Digit runs that read as an ordinary spoken number, not a year, time, model, 24/7 or name. */
export function ordinaryNumbers(text: string): string[] {
	const found: string[] = [];
	for (const match of text.matchAll(NUMBER_RUN)) {
		const t = match[0];
		const at = match.index ?? 0;
		const before = text.slice(0, at);
		const after = text.slice(at + t.length);
		// 8:30, 24/7, 5-0, 9-1-1
		if (/[:/]/.test(t) || /^\d+(?:-\d+)+$/.test(t)) continue;
		// years and '94
		if (/^(?:18|19|20)\d\d$/.test(t) || /['’]$/.test(before)) continue;
		// 24K, 90s, 1st, 9mm, 4ever, 8 a.m., 6 o'clock
		if (
			/^(?:k\b|s\b|st\b|nd\b|rd\b|th\b|mm\b|cm\b|kg\b|lbs?\b|x\b|%|[\p{L}\p{N}_]|-[a-z])/iu.test(
				after,
			) ||
			/^\s*(?:a\.?m\b|p\.?m\b|o'clock)/i.test(after)
		)
			continue;
		// G5, N9, TEC-9, .44
		if (before && (/\p{L}$/u.test(before) || /(?:\.|[A-Za-z]-)$/.test(before)))
			continue;
		// Area 51, Nintendo 64, Cloud 9
		if (/[A-Z][\p{L}\p{N}_'’-]*\s+$/u.test(before)) continue;
		found.push(t);
	}
	return found;
}

function spokenNumbers(lines: LyricLine[]): LintProblem[] {
	if (!isEnglishLyric(lines)) return [];
	const out: LintProblem[] = [];
	for (const line of lines) {
		const number = ordinaryNumbers(lineText(line))[0];
		if (!number) continue;
		out.push(
			hint(
				SPOKEN_NUMBER_RULE,
				line,
				out.length,
				`"${number}" looks like an ordinary spoken number. Spell it out unless it's a year, time, model, caliber, 24/7, 5-0, 24K or a name.`,
				{ key: "linter.spokenNumber", params: { number } },
				line.words
					.filter((word) => word.word.includes(number))
					.map((w) => w.id),
			),
		);
	}
	return out;
}

function decorativeSymbols(lines: LyricLine[]): LintProblem[] {
	const out: LintProblem[] = [];
	for (const line of lines) {
		const symbol = SYMBOLS.exec(lineText(line))?.[0];
		if (!symbol) continue;
		out.push(
			hint(
				DECORATIVE_SYMBOL_RULE,
				line,
				out.length,
				`Decorative symbol "${symbol}" in the lyrics. Leave it out.`,
				{ key: "linter.decorativeSymbol", params: { symbol } },
				line.words
					.filter((word) => word.word.includes(symbol))
					.map((w) => w.id),
			),
		);
	}
	return out;
}

export function toolRuleProblems(lines: LyricLine[]): LintProblem[] {
	return [
		...wordGaps(lines),
		...spokenNumbers(lines),
		...decorativeSymbols(lines),
	];
}
