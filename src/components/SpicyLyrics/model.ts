/*
 * Adapted from the Spicy Lyrics renderer (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */
import { collectFollowingBackgroundLines } from "$/modules/project/logic/ttml-writer";
import type { LyricLine, LyricWord } from "$/types/ttml";

export interface SpicyToken {
	id: string;
	text: string;
	startTime: number;
	endTime: number;
	letters?: string[];
	isBackground: boolean;
	spaceAfter?: boolean;
	breakAfter?: boolean;
	allowInternalWrap?: boolean;
}

export interface SpicyTokenLayoutItem {
	token: SpicyToken;
	wordIndex: number;
}

export interface SpicyWordGroup {
	items: SpicyTokenLayoutItem[];
	hasTrailingSpace: boolean;
}

export interface SpicyLine {
	id: string;
	startTime: number;
	endTime: number;
	isLineSynced: boolean;
	isRtl: boolean;
	text?: string;
	isBackground: boolean;
	isDuet: boolean;
	isDotLine?: boolean;
	translation?: string;
	words: SpicyToken[];
}

/** Gap between two vocal groups that gets an interlude, and the dots' lead-out. */
const INTERLUDE_GAP = 3000;
const INTERLUDE_PADDING = 550;

/**
 * A line-synced lyric is direct text in a timed TTML <p>; word-synced lyrics
 * use timed spans. Preserve the parser's structural distinction instead of
 * inferring it from the number or content of words.
 */
function isLineSynced(line: LyricLine) {
	return !!line.isLineSynced;
}

/**
 * Spicy drops zero-width spaces, direction marks, word joiners and BOMs before
 * it renders text: they would otherwise become empty letters with their own
 * share of a held word. ZWJ and ZWNJ stay, since they shape Arabic, Indic and
 * emoji text.
 */
const zeroWidth = new RegExp(
	`[${String.fromCodePoint(0x200b, 0x200e, 0x200f, 0x2060, 0xfeff)}]`,
	"gu",
);
export const stripZeroWidth = (text: string) => text.replace(zeroWidth, "");

function lineText(line: LyricLine, romanized: boolean) {
	if (romanized && line.romanLyric?.trim())
		return stripZeroWidth(line.romanLyric);
	return stripZeroWidth(
		line.words
			.map((word) =>
				romanized && word.romanWord.trim().length > 0
					? word.romanWord
					: word.word,
			)
			.join(""),
	);
}

/** Match Spicy's first-strong-character direction check. */
export function isRtl(text: string) {
	for (const character of text) {
		if (/[\d\s,.;:?!()[\]{}"'\\/<>@#$%^&*_=+-]/u.test(character)) continue;
		return /[\u0590-\u05FF\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB1D-\uFB4F\uFB50-\uFDFF\uFE70-\uFEFF]/u.test(
			character,
		);
	}
	return false;
}
const isCjk = (text: string) =>
	/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}]/u.test(
		text,
	);

// The app's TypeScript lib predates Intl.Segmenter; every webview we ship has it.
type GraphemeSegmenter = {
	segment(text: string): Iterable<{ segment: string }>;
};
const Segmenter = (
	Intl as unknown as {
		Segmenter?: new (
			locale: undefined,
			options: { granularity: "grapheme" },
		) => GraphemeSegmenter;
	}
).Segmenter;
const segmenter = Segmenter
	? new Segmenter(undefined, { granularity: "grapheme" })
	: null;
// Viramas of the Brahmic scripts plus ZERO WIDTH JOINER: the segmenter splits
// after them in some scripts, which breaks the conjunct across two spans.
const joinsNext =
	/[\u094D\u09CD\u0A4D\u0ACD\u0B4D\u0BCD\u0C4D\u0CCD\u0D4D\u0DCA\u1039\u17D2\u200D]$/u;

/**
 * Split text into the units a held word animates letter by letter. Each unit
 * is its own inline-block and text never shapes across spans, so a unit must
 * be a whole glyph cluster.
 */
export function splitLetters(text: string): string[] {
	const graphemes = segmenter
		? Array.from(segmenter.segment(text), (part) => part.segment)
		: Array.from(text);
	const letters: string[] = [];
	for (const grapheme of graphemes) {
		const last = letters.length - 1;
		if (
			last >= 0 &&
			joinsNext.test(letters[last]) &&
			grapheme.trim().length > 0
		)
			letters[last] += grapheme;
		else letters.push(grapheme);
	}
	return letters;
}

const validLine = (start: number, end: number) =>
	Number.isFinite(start) && Number.isFinite(end) && end > start;
// A zero-length syllable still renders in Spicy; it is simply sung at once.
const validWord = (start: number, end: number) =>
	Number.isFinite(start) && Number.isFinite(end) && end >= start;

/**
 * Spicy Lyrics keeps timed syllables flat for animation, then adds layout-only
 * word-group wrappers around syllables connected by IsPartOfWord. TTML stores
 * the same boundary as a literal whitespace node, represented here by
 * spaceAfter on the preceding token.
 */
export function groupSpicyTokens(tokens: SpicyToken[]): SpicyWordGroup[] {
	const groups: SpicyWordGroup[] = [];
	let items: SpicyTokenLayoutItem[] = [];

	for (let wordIndex = 0; wordIndex < tokens.length; wordIndex++) {
		const token = tokens[wordIndex];
		items.push({ token, wordIndex });

		if (
			token.spaceAfter ||
			token.breakAfter ||
			wordIndex === tokens.length - 1
		) {
			groups.push({
				items,
				hasTrailingSpace: !!token.spaceAfter && wordIndex < tokens.length - 1,
			});
			items = [];
		}
	}

	return groups;
}

function makeToken(
	word: LyricWord,
	simple: boolean,
	romanized: boolean,
	background: boolean,
): SpicyToken {
	const usesRomanization = romanized && !!word.romanWord.trim();
	// Spicy trims every syllable, and drops a background vocal's parentheses.
	const clean = (value: string) =>
		background ? value.trim().replace(/[()]/g, "").trim() : value.trim();
	const text = stripZeroWidth(
		clean(usesRomanization ? word.romanWord : word.word),
	);
	const allowInternalWrap = usesRomanization || isCjk(word.word) || isCjk(text);
	const duration = word.endTime - word.startTime;
	const letters = duration >= (simple ? 1050 : 1000) ? splitLetters(text) : [];
	const letterCapable =
		letters.length > 0 && !isRtl(text) && (!simple || letters.length <= 12);
	// Spicy's Emphasize helper gives held words their own timing window. In
	// normal mode it finishes the letter pass 250ms before the word end; simple
	// mode applies its matching start/end offsets.
	const emphasisStart = simple ? word.startTime + 21 : word.startTime;
	const emphasisEnd = simple ? word.endTime + 40 : word.endTime - 250;
	return {
		id: word.id,
		text,
		startTime: letterCapable ? emphasisStart : word.startTime,
		endTime:
			letterCapable && emphasisEnd > emphasisStart ? emphasisEnd : word.endTime,
		letters: letterCapable ? letters : undefined,
		isBackground: background,
		breakAfter: allowInternalWrap,
		allowInternalWrap,
	};
}

/**
 * TTML literal text nodes, including spaces between timed spans, are represented
 * by the editor as zero-timed lyric words. Keep those boundaries; never infer
 * them from the script or from romanization, since a timed lyric word can be a
 * syllable rather than a complete word.
 *
 * Spicy only joins a syllable to the next one when their spans touch and
 * neither side carries the break itself: a syllable ending in whitespace or a
 * comma, or a following one starting with whitespace, ends the word.
 */
function makeTokens(
	words: LyricWord[],
	simple: boolean,
	romanized: boolean,
	background: boolean,
): SpicyToken[] {
	const tokens: SpicyToken[] = [];

	for (const word of words) {
		const previous = tokens[tokens.length - 1];
		if (/^\s*$/u.test(word.word)) {
			if (previous && word.word.length > 0) previous.spaceAfter = true;
			continue;
		}
		if (previous && /^\s/u.test(word.word)) previous.spaceAfter = true;
		if (!validWord(word.startTime, word.endTime)) continue;

		const token = makeToken(word, simple, romanized, background);
		if (token.text.length === 0) continue;
		if (/[\s,]$/u.test(word.word)) token.spaceAfter = true;
		tokens.push(token);
	}

	return tokens;
}

function dotLine(
	startTime: number,
	endTime: number,
	id: string,
	isDuet: boolean,
	isRtl: boolean,
): SpicyLine {
	const total = endTime - startTime;
	const base = total / 3;
	const first = Math.max(startTime, startTime + base - INTERLUDE_PADDING / 3);
	const second = Math.max(
		first,
		startTime + base * 2 - (INTERLUDE_PADDING * 2) / 3,
	);
	const third = Math.max(second, endTime - INTERLUDE_PADDING);
	return {
		id,
		startTime,
		endTime,
		isLineSynced: false,
		isRtl,
		isBackground: false,
		// An interlude leads into its following vocal line, so it uses that
		// line's side rather than the side of the lyric that just finished.
		isDuet,
		isDotLine: true,
		words: [
			{
				id: `${id}-0`,
				text: "•",
				startTime,
				endTime: first,
				isBackground: false,
			},
			{
				id: `${id}-1`,
				text: "•",
				startTime: first,
				endTime: second,
				isBackground: false,
			},
			{
				id: `${id}-2`,
				text: "•",
				startTime: second,
				endTime: third,
				isBackground: false,
			},
		],
	};
}

/** One TTML <p>: a lead vocal and the background vocals nested inside it. */
export interface SpicyVocalGroup {
	lead: SpicyLine;
	backgrounds: SpicyLine[];
}

/**
 * Nest the editor's flat background lines under their lead the way the TTML
 * export writes them, so the preview shows what Spicy Lyrics receives:
 * - a lead takes its following background line, or every consecutive one when
 *   consecutive background lines are allowed;
 * - with that setting on, a background line with no lead becomes a <p> holding
 *   only background vocals (an empty lead);
 * - otherwise a background line the lead could not take is exported, and so
 *   rendered, as a lead line.
 */
export function groupVocals(
	source: LyricLine[],
	simple: boolean,
	romanized: boolean,
	forceLineSynced = false,
	allowConsecutiveBackgrounds = false,
): SpicyVocalGroup[] {
	const lines = source.filter((line) =>
		validLine(line.startTime, line.endTime),
	);
	const groups: SpicyVocalGroup[] = [];
	const convert = (line: LyricLine, background: boolean): SpicyLine => ({
		id: line.id,
		startTime: line.startTime,
		endTime: line.endTime,
		isLineSynced: forceLineSynced || isLineSynced(line),
		isRtl: isRtl(lineText(line, false)),
		text: lineText(line, romanized),
		isBackground: background,
		isDuet: !!line.isDuet,
		translation: line.translatedLyric || undefined,
		words: makeTokens(line.words, simple, romanized, background),
	});

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index];
		const standalone = allowConsecutiveBackgrounds && !!line.isBG;
		const following = collectFollowingBackgroundLines(
			lines,
			index,
			allowConsecutiveBackgrounds,
		);
		index += following.length;

		const backgroundSources = standalone ? [line, ...following] : following;
		const lead: SpicyLine = standalone
			? {
					id: `${line.id}:lead`,
					startTime: line.startTime,
					endTime:
						backgroundSources[backgroundSources.length - 1]?.endTime ??
						line.endTime,
					isLineSynced: false,
					isRtl: false,
					text: "",
					isBackground: false,
					isDuet: !!line.isDuet,
					words: [],
				}
			: convert(line, false);
		const backgrounds: SpicyLine[] = [];
		for (const backgroundSource of backgroundSources) {
			const background = convert(backgroundSource, true);
			if (!background.isLineSynced && background.words.length === 0) continue;
			// A background vocal spans its first to its last syllable as timed
			// (not the shortened held-letter window), and sits on its lead's side,
			// since it shares the lead's <p> and agent.
			const sung = backgroundSource.words.filter(
				(word) =>
					word.word.trim().length > 0 &&
					validWord(word.startTime, word.endTime),
			);
			if (!background.isLineSynced && sung.length > 0) {
				background.startTime = sung[0].startTime;
				background.endTime = sung[sung.length - 1].endTime;
			}
			background.isDuet = lead.isDuet;
			// Background vocals can start before or run past their lead; the
			// lead's window covers them, so the next line waits for the group.
			lead.startTime = Math.min(lead.startTime, background.startTime);
			lead.endTime = Math.max(lead.endTime, background.endTime);
			backgrounds.push(background);
		}
		if (lead.words.length === 0 && !lead.isLineSynced && !backgrounds.length)
			continue;
		groups.push({ lead, backgrounds });
	}

	return groups;
}

/**
 * Lay the vocal groups out as Spicy renders them: each lead, then its
 * background rows, then an interlude if the next group starts at least three
 * seconds after this lead (and so all of its background vocals) has ended.
 */
export function buildSpicyLines(
	source: LyricLine[],
	simple: boolean,
	romanized: boolean,
	forceLineSynced = false,
	allowConsecutiveBackgrounds = false,
): SpicyLine[] {
	const groups = groupVocals(
		source,
		simple,
		romanized,
		forceLineSynced,
		allowConsecutiveBackgrounds,
	);
	const result: SpicyLine[] = [];
	const first = groups[0]?.lead;
	if (first && first.startTime >= INTERLUDE_GAP)
		result.push(
			dotLine(
				0,
				first.startTime,
				"spicy-leading-dot",
				first.isDuet,
				first.isRtl,
			),
		);
	for (let index = 0; index < groups.length; index++) {
		const { lead, backgrounds } = groups[index];
		result.push(lead, ...backgrounds);
		const next = groups[index + 1]?.lead;
		if (next && next.startTime - lead.endTime >= INTERLUDE_GAP)
			result.push(
				dotLine(
					lead.endTime,
					next.startTime,
					`spicy-dot-${lead.id}`,
					next.isDuet,
					next.isRtl,
				),
			);
	}
	return result;
}

export const keyFor = (line: SpicyLine, word: SpicyToken, index: number) =>
	`${line.id}:${word.id}:${index}`;
