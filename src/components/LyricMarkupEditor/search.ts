import type { MarkupLine } from "./markup";
import type { TextChange } from "./text-changes";

/** Which rows a search looks at. Section headers are never searched. */
export type SearchRows = "all" | "lyrics" | "translations";

export interface SearchOptions {
	query: string;
	caseSensitive: boolean;
	wholeWord: boolean;
	regex: boolean;
	rows: SearchRows;
	/** Only matches inside this range of the text count. */
	within?: { from: number; to: number } | null;
}

export interface SearchMatch {
	/** Offsets in the whole text. A match never starts or ends on a split mark. */
	from: number;
	to: number;
	/** 0-based line the match is on. */
	line: number;
	/** Whether it is in lyric text or a translation or romanization. */
	row: "lyric" | "translation";
	/** The matched text with split marks left out. */
	text: string;
	/** The regex groups, for `$1` and friends in the replacement. */
	groups: string[];
	named?: Record<string, string>;
}

export type SearchResult =
	| { matches: SearchMatch[]; error?: undefined }
	| { matches: []; error: "invalid" };

const LYRIC_KINDS = new Set(["lyric", "background", "duet"]);
const SUB_KINDS = new Set(["translation", "romanization"]);
const WORD_CHAR = /[\p{L}\p{N}\p{M}_]/u;

/**
 * A run of searchable text on one line, with split marks left out. `offsets[i]`
 * is where character `i` of `text` sits in the line.
 */
interface Region {
	text: string;
	offsets: number[];
	/** Each left-out mark: before which character of `text`, and its own text. */
	marks: { at: number; text: string }[];
	row: SearchMatch["row"];
}

function regionsOf(
	lineText: string,
	line: MarkupLine,
	rows: SearchRows,
	keepMarks: boolean,
): Region[] {
	const wantLyrics = rows !== "translations";
	const wantSubs = rows !== "lyrics";
	const regions: Region[] = [];
	let current: Region | null = null;
	const close = () => {
		if (current?.text) regions.push(current);
		current = null;
	};
	for (const span of line.spans) {
		let row: Region["row"] | null = null;
		if (SUB_KINDS.has(line.kind)) row = "translation";
		else if (LYRIC_KINDS.has(line.kind)) {
			if (span.type === "subText") row = "translation";
			else if (
				span.type === "text" ||
				span.type === "split" ||
				span.type === "spaceMark"
			)
				row = "lyric";
		}
		if (!row || (row === "lyric" ? !wantLyrics : !wantSubs)) {
			close();
			continue;
		}
		if (current && current.row !== row) close();
		current ??= { text: "", offsets: [], marks: [], row };
		if ((span.type === "split" || span.type === "spaceMark") && !keepMarks) {
			current.marks.push({
				at: current.text.length,
				text: lineText.slice(span.from, span.to),
			});
			continue;
		}
		for (let index = span.from; index < span.to; index++) {
			current.text += lineText[index];
			current.offsets.push(index);
		}
	}
	close();
	return regions;
}

const escapeRegex = (text: string) =>
	text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

function buildRegex(options: SearchOptions): RegExp | null {
	const source = options.regex ? options.query : escapeRegex(options.query);
	try {
		return new RegExp(source, `gu${options.caseSensitive ? "" : "i"}`);
	} catch {
		return null;
	}
}

const isWordBoundary = (text: string, index: number) =>
	!WORD_CHAR.test(text[index - 1] ?? "") || !WORD_CHAR.test(text[index] ?? "");

/**
 * Every match of the search in the text, in order. Lyric text is searched with
 * its split marks left out, so "beautiful" finds `beau\ti\ful`; a plain search
 * that contains the mark itself looks at the marks as written.
 */
export function findMatches(
	text: string,
	lines: MarkupLine[],
	options: SearchOptions,
	wordSeparator: string,
): SearchResult {
	if (!options.query) return { matches: [] };
	const regex = buildRegex(options);
	if (!regex) return { matches: [], error: "invalid" };
	const keepMarks =
		!wordSeparator || (!options.regex && options.query.includes(wordSeparator));
	const rawLines = text.split("\n");
	const matches: SearchMatch[] = [];
	let lineStart = 0;
	for (let index = 0; index < rawLines.length; index++) {
		const lineText = rawLines[index];
		const line = lines[index];
		if (line) {
			for (const region of regionsOf(lineText, line, options.rows, keepMarks)) {
				regex.lastIndex = 0;
				for (
					let found = regex.exec(region.text);
					found;
					found = regex.exec(region.text)
				) {
					const start = found.index;
					const end = start + found[0].length;
					// A zero-width pattern would otherwise match here forever.
					if (end === start) {
						regex.lastIndex = start + 1;
						continue;
					}
					if (
						options.wholeWord &&
						!(
							isWordBoundary(region.text, start) &&
							isWordBoundary(region.text, end)
						)
					)
						continue;
					const from = lineStart + region.offsets[start];
					const to = lineStart + region.offsets[end - 1] + 1;
					if (
						options.within &&
						(from < options.within.from || to > options.within.to)
					)
						continue;
					matches.push({
						from,
						to,
						line: index,
						row: region.row,
						text: found[0],
						groups: found.slice(1).map((group) => group ?? ""),
						...(found.groups ? { named: { ...found.groups } } : {}),
					});
				}
			}
		}
		lineStart += lineText.length + 1;
	}
	return { matches };
}

/** The replacement for one match, with `$1`, `$&`, `$<name>` and `$$` filled in. */
export function expandReplacement(
	template: string,
	match: SearchMatch,
	regex: boolean,
): string {
	if (!regex) return template;
	return template.replace(
		/\$(\$|&|<([^>]*)>|(\d{1,2}))/g,
		(whole, token: string, name?: string, digits?: string) => {
			if (token === "$") return "$";
			if (token === "&") return match.text;
			if (name !== undefined) return match.named?.[name] ?? whole;
			const number = Number(digits);
			if (number >= 1 && number <= match.groups.length)
				return match.groups[number - 1];
			// "$12" with one group reads as group 1 and a literal "2".
			const first = Number(digits?.[0]);
			if (digits && digits.length === 2 && first >= 1)
				return first <= match.groups.length
					? match.groups[first - 1] + digits[1]
					: whole;
			return whole;
		},
	);
}

/**
 * Puts the split marks of the replaced text back where the letters didn't
 * change: `col\our` replaced with "color" gives `col\or`. Marks inside the
 * changed letters are dropped. A replacement that writes its own marks, or a
 * search that matched the marks as written, is used as it is.
 */
export function keepMarks(
	original: string,
	matched: string,
	replacement: string,
	wordSeparator: string,
): string {
	if (!wordSeparator || replacement.includes(wordSeparator)) return replacement;
	if (!original.includes(wordSeparator) || original === matched)
		return replacement;
	// Where each mark sits in the matched text, the marks left out.
	const marks: { at: number; text: string }[] = [];
	let plainIndex = 0;
	for (let index = 0; index < original.length; ) {
		if (original.startsWith(wordSeparator, index)) {
			marks.push({ at: plainIndex, text: wordSeparator });
			index += wordSeparator.length;
		} else {
			plainIndex++;
			index++;
		}
	}
	let head = 0;
	while (
		head < matched.length &&
		head < replacement.length &&
		matched[head] === replacement[head]
	)
		head++;
	let tail = 0;
	while (
		tail < matched.length - head &&
		tail < replacement.length - head &&
		matched[matched.length - 1 - tail] ===
			replacement[replacement.length - 1 - tail]
	)
		tail++;
	const shift = replacement.length - matched.length;
	const kept = new Map<number, string>();
	for (const mark of marks) {
		let at: number | null = null;
		if (mark.at <= head) at = mark.at;
		else if (mark.at >= matched.length - tail) at = mark.at + shift;
		// A mark at either end would turn into a space mark.
		if (at !== null && at > 0 && at < replacement.length)
			kept.set(at, mark.text);
	}
	let result = "";
	for (let index = 0; index < replacement.length; index++) {
		result += kept.get(index) ?? "";
		result += replacement[index];
	}
	return result;
}

/** The edits that replace the given matches, in text order. */
export function replacementChanges(
	text: string,
	matches: SearchMatch[],
	template: string,
	options: Pick<SearchOptions, "regex">,
	wordSeparator: string,
): TextChange[] {
	return matches.map((match) => {
		const original = text.slice(match.from, match.to);
		const replacement = expandReplacement(template, match, options.regex);
		return {
			from: match.from,
			to: match.to,
			insert: keepMarks(original, match.text, replacement, wordSeparator),
		};
	});
}

/** Applies non-overlapping, sorted changes to a string. */
export function applyChanges(text: string, changes: TextChange[]): string {
	let result = "";
	let position = 0;
	for (const change of changes) {
		result += text.slice(position, change.from) + change.insert;
		position = change.to;
	}
	return result + text.slice(position);
}
