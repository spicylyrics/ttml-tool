const isCJKChar = (char: string) =>
	/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
		char,
	);
const isAlphaNum = (char: string) => /[\p{L}\p{N}]/u.test(char);
const isLatinAlphaNum = (char: string) => /[\p{Script=Latin}\p{N}]/u.test(char);
const isComma = (char: string) => /[,，、]/u.test(char);
/** Marks that close a phrase and belong to the word before them. */
const CLOSING = `"'”’»)]}`;
/** Marks that open a phrase and belong to the word after them. */
const OPENING = `"'“‘«([{`;
const charClass = (chars: string) => `[${chars.replace(/[\]\\[^-]/g, "\\$&")}]`;

/** The steps Process lyrics runs. Each can be turned off; all are on by default. */
export interface LyricPrepOptions {
	/** Drop inline `[...]` notes inside a line. */
	removeInlineBrackets: boolean;
	/** Move `(...)` vocals to their own background line. */
	backgroundVocals: boolean;
	/** Start background lines with a capital letter. */
	capitalizeBackground: boolean;
	/** Turn `--`, `- ` and stray hyphens into em dashes. */
	emDashes: boolean;
	/** Split hyphenated words after the hyphen. */
	splitHyphens: boolean;
	/** Split CJK text into characters and at script changes. */
	splitCjk: boolean;
	/** One space after commas, none before punctuation, quotes kept on their word. */
	punctuationSpacing: boolean;
	/** Collapse runs of spaces into one. */
	collapseSpaces: boolean;
	/** Mark spaces as word boundaries for the importer. */
	splitWords: boolean;
}

export const DEFAULT_LYRIC_PREP_OPTIONS: LyricPrepOptions = {
	removeInlineBrackets: true,
	backgroundVocals: true,
	capitalizeBackground: true,
	emDashes: true,
	splitHyphens: true,
	splitCjk: true,
	punctuationSpacing: true,
	collapseSpaces: true,
	splitWords: true,
};

/**
 * Finds where Japanese words start in a text (UTF-16 offsets), when the
 * dictionary is loaded. Process lyrics then splits Japanese into words, not
 * characters.
 */
export type JapaneseWordFinder = (text: string) => Set<number>;

const normalize = (
	value: string,
	options: LyricPrepOptions,
	japaneseWords?: JapaneseWordFinder,
) => {
	const chars = Array.from(value);
	let processed = "";
	for (let index = 0; index < chars.length; index++) {
		const char = chars[index];
		if (char !== "-") {
			processed += char;
			continue;
		}
		const nextChar = chars[index + 1];
		const inWord =
			!!nextChar &&
			index > 0 &&
			isAlphaNum(chars[index - 1]) &&
			isAlphaNum(nextChar);
		if (nextChar === "\\") {
			// Already split after the hyphen by an earlier pass; keep it.
			processed += "-";
		} else if (inWord) {
			processed += options.splitHyphens ? "-\\" : "-";
		} else if (!options.emDashes) {
			processed += "-";
		} else if (nextChar === " ") {
			processed += "— ";
			index++;
		} else if (nextChar === "-") {
			processed += "—";
			index++;
		} else {
			processed += "—";
		}
	}

	if (options.splitCjk) {
		const processedChars = Array.from(processed);
		// Japanese splits into words when the dictionary can say where they
		// are; Chinese, and Japanese without it, one character at a time.
		const wordStarts = japaneseWords?.(processed);
		let cjkProcessed = "";
		let offset = 0;
		for (let index = 0; index < processedChars.length; index++) {
			const char = processedChars[index];
			const nextChar = processedChars[index + 1] ?? "";
			cjkProcessed += char;
			offset += char.length;
			const insideCjk = isCJKChar(char) && isCJKChar(nextChar);
			if (
				(insideCjk && (!wordStarts || wordStarts.has(offset))) ||
				(isCJKChar(char) && isLatinAlphaNum(nextChar)) ||
				(isLatinAlphaNum(char) && isCJKChar(nextChar)) ||
				(isComma(char) && (isCJKChar(nextChar) || isLatinAlphaNum(nextChar)))
			) {
				cjkProcessed += "\\";
			}
		}
		processed = cjkProcessed;
	}

	if (options.punctuationSpacing) {
		processed = processed
			// A comma touching a closing mark (`sorry,"`) stays touching it.
			.replace(/\s*,(\s*)(?=(.?))/gu, (_match, space: string, next: string) =>
				!next || (!space && CLOSING.includes(next)) ? "," : ", ",
			)
			.replace(/\s+,/g, ",")
			.replace(/\s+(?=[,.;:!?])/g, "")
			// A closing mark left alone by a space joins the word before it,
			// and an opening one the word after it.
			.replace(new RegExp(`\\s+(${charClass(CLOSING)}+)(?=\\s|$)`, "gu"), "$1")
			.replace(new RegExp(`(^|\\s)(${charClass(OPENING)}+)\\s+`, "gu"), "$1$2");
	}
	if (options.collapseSpaces) processed = processed.replace(/\s+/g, " ");
	// Edges are always trimmed: the line itself is, and removed parts leave gaps.
	return processed.trim();
};

const capitalize = (text: string, options: LyricPrepOptions) =>
	options.capitalizeBackground
		? text.charAt(0).toUpperCase() + text.slice(1)
		: text;

/**
 * Lowercases the first letter of a background part that joins an earlier one,
 * so `(When you) ... (Ride it)` reads "When you, ride it". "I" and words in
 * capitals (`OK`, `NYC`) keep their case.
 */
const lowercaseJoined = (text: string) => {
	const first = text.match(/^[^\s,]+/u)?.[0] ?? "";
	if (/^I(?![\p{L}])/u.test(first)) return text;
	const letters = first.replace(/[^\p{L}]/gu, "");
	if (letters.length > 1 && letters === letters.toUpperCase()) return text;
	return text.charAt(0).toLowerCase() + text.slice(1);
};

/**
 * Called when a line had more than one background part and they were joined
 * into one background line. `suggestion` is the line as plain text with the
 * joined parts in brackets at the end, ready for the user to correct and run
 * through Process lyrics again.
 */
export type JoinedBackgroundHandler = (suggestion: string) => void;

/**
 * Process one lyric line into the plain-text import representation.
 * Running it on its own output gives the same output: escaped spaces are read
 * back as spaces and existing split marks are kept.
 */
export const prepareLyricLine = (
	line: string,
	steps: Partial<LyricPrepOptions> = {},
	japaneseWords?: JapaneseWordFinder,
	onJoinedBackground?: JoinedBackgroundHandler,
) => {
	const options = { ...DEFAULT_LYRIC_PREP_OPTIONS, ...steps };
	const backgroundVocals: string[] = [];
	let mainLine = "";
	let currentParen = "";
	let inParen = false;
	let source = line
		.replace(/\\? \\?/g, " ")
		.replace(/^\\+|\\+$/g, "")
		.trim();
	if (options.removeInlineBrackets) source = source.replace(/\[.*?\]/g, "");

	for (const char of source) {
		if (!options.backgroundVocals) {
			mainLine += char;
		} else if (["(", "（"].includes(char) && !inParen) {
			inParen = true;
			currentParen = "";
		} else if ([")", "）"].includes(char) && inParen) {
			inParen = false;
			backgroundVocals.push(currentParen.trim());
		} else if (inParen) {
			currentParen += char;
		} else {
			mainLine += char;
		}
	}

	const main = normalize(mainLine, options, japaneseWords);
	const parts = backgroundVocals
		.map((vocal) => normalize(vocal, options, japaneseWords))
		.filter(Boolean)
		.map((part, index) =>
			index > 0 && options.capitalizeBackground ? lowercaseJoined(part) : part,
		);
	const background = parts.join(", ");
	if (parts.length > 1)
		onJoinedBackground?.(
			[main, `(${capitalize(background, options)})`].filter(Boolean).join(" "),
		);
	const output = background
		? main
			? `${main}\n<${capitalize(background, options)}`
			: `<${capitalize(background, options)}`
		: main;
	return options.splitWords ? output.replace(/ /g, "\\ \\") : output;
};
