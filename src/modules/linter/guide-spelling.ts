import type { LyricLine } from "$/types/ttml";

/**
 * Preferred spellings from the Spelling Standards guide that the bot's own
 * list doesn't cover. Tool-only, so it has its own rule id.
 */
export const GUIDE_SPELLING_RULE = "guide-spelling";

export type GuideSpellingContext =
	| "because"
	| "interjection"
	| "gardenTool"
	| "percocet";

const ENTRIES: {
	preferred: string;
	variants: string[];
	context?: GuideSpellingContext;
}[] = [
	{ preferred: "'cause", variants: ["cause"], context: "because" },
	// "till" and plain "perk" are left out, as in the ttml-review checker:
	// "till" is right in British English, "perk" is an everyday word.
	{ preferred: "ayy", variants: ["aye", "ay"], context: "interjection" },
	{ preferred: "ho", variants: ["hoe"], context: "gardenTool" },
	{ preferred: "Perc'", variants: ["perky", "percy"], context: "percocet" },
	{ preferred: "lil'", variants: ["lil", "li'l"] },
	{ preferred: "a.k.a.", variants: ["aka", "a.k.a"] },
	{ preferred: "HAM", variants: ["h.a.m", "h.a.m."] },
];
const LOOKUP = new Map<string, (typeof ENTRIES)[number]>();
for (const entry of ENTRIES)
	for (const variant of entry.variants) LOOKUP.set(variant, entry);

// Same punctuation the bot peels off a token; apostrophes stay with the word.
const EDGE_PUNCTUATION = `"“”(),.!?;:[]{}¿¡`;

function bare(token: string): string {
	let start = 0;
	let end = token.length;
	while (start < end && EDGE_PUNCTUATION.includes(token[start])) start++;
	while (end > start && EDGE_PUNCTUATION.includes(token[end - 1])) end--;
	return token.slice(start, end);
}

// The bot's English guess, run on the editor text, so these spellings only
// show up where the bot's own spelling hints would.
const ENGLISH_MARKERS = new Set(
	"the a an and but or of to in on at for with from is are was were be been am i you he she we they it me him her us them my your our their this that not no do don't can't won't i'm you're it's what when where why how all".split(
		" ",
	),
);
const LATIN_LETTER = /\p{Script=Latin}/u;

const lineText = (line: LyricLine) =>
	line.words
		.map((word) => word.word)
		.join("")
		.replace(/\s+/g, " ")
		.trim();

export function isEnglishLyric(lines: LyricLine[]): boolean {
	const text = lines
		.filter((line) => !line.isBG)
		.map(lineText)
		.join(" ");
	const letters = text.match(/\p{L}/gu) ?? [];
	if (letters.length < 20) return false;
	const latin = letters.filter((c) => LATIN_LETTER.test(c)).length;
	const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
	const markers = words.filter((w) => ENGLISH_MARKERS.has(w)).length;
	return (
		latin / letters.length >= 0.7 && markers / Math.max(words.length, 1) >= 0.15
	);
}

export interface GuideSpellingHit {
	lineId: string;
	wordIds: string[];
	found: string;
	preferred: string;
	context?: GuideSpellingContext;
	timeMs: number;
}

/** One hit per preferred spelling per line, like the bot's `spelling` rule. */
export function findGuideSpellings(lines: LyricLine[]): GuideSpellingHit[] {
	if (!isEnglishLyric(lines)) return [];
	const hits: GuideSpellingHit[] = [];
	for (const line of lines) {
		let text = "";
		const owner: string[] = [];
		for (const word of line.words) {
			text += word.word;
			for (let i = 0; i < word.word.length; i++) owner.push(word.id);
		}
		const seen = new Set<string>();
		for (const match of text.matchAll(/\S+/g)) {
			const token = bare(match[0]);
			const entry = LOOKUP.get(token.toLowerCase());
			if (!entry || seen.has(entry.preferred)) continue;
			seen.add(entry.preferred);
			const from = match.index ?? 0;
			const ids = new Set(owner.slice(from, from + match[0].length));
			const first = line.words.find((word) => ids.has(word.id));
			hits.push({
				lineId: line.id,
				wordIds: [...ids],
				found: token,
				preferred: entry.preferred,
				context: entry.context,
				timeMs: first?.startTime ?? line.startTime,
			});
		}
	}
	return hits;
}
