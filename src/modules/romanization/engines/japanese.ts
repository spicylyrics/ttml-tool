import type { IpadicFeatures, Tokenizer } from "kuromoji";
import { kanaToRomaji as toRomaji } from "kuroshiro/lib/util";

/**
 * Japanese romanization on the device, like Spicy Lyrics Mobile: kuromoji
 * (IPADIC) reads the whole line, so kanji get their reading in context and
 * words split into syllables keep it, and kuroshiro's Hepburn writes it out.
 * The spelling follows Genius romanized pages: long vowels as written
 * ("kyou", "koohii"), particles as said ("wa", "e", "wo"), and a gap between
 * words with endings kept on their word ("kimi no namae wo yonde ita").
 *
 * The dictionary loads the first time it's needed.
 */

const DICT_PATH = `${import.meta.env.BASE_URL}kuromoji-dict/`;

let tokenizer: Promise<Tokenizer<IpadicFeatures>> | undefined;
/** The tokenizer once loaded, for code that can't wait for it. */
let loadedTokenizer: Tokenizer<IpadicFeatures> | undefined;

export const getLoadedJapaneseTokenizer = () => loadedTokenizer;

const KANA = /[\p{Script=Hiragana}\p{Script=Katakana}]/u;
/** Whether a text needs the Japanese dictionary: any kana in it. */
export const needsJapaneseDictionary = (text: string) => KANA.test(text);

/**
 * Process lyrics' Japanese word finder for a text, when it has kana and the
 * dictionary is loaded; otherwise it keeps splitting by character.
 */
export const loadedJapaneseWordFinder = (text: string) => {
	const tk = loadedTokenizer;
	if (!tk || !needsJapaneseDictionary(text)) return undefined;
	return (value: string) => japaneseWordStarts(tk, value);
};

export function loadJapaneseTokenizer() {
	// The browser build: the package's main entry needs Node's path module.
	tokenizer ??= import("kuromoji/build/kuromoji.js")
		.then(
			({ default: kuromoji }) =>
				new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) => {
					kuromoji.builder({ dicPath: DICT_PATH }).build((error, built) => {
						if (error) reject(error);
						else resolve(built);
					});
				}),
		)
		.then((built) => {
			loadedTokenizer = built;
			return built;
		})
		.catch((error) => {
			// Let the next attempt try again, after a dropped connection say.
			tokenizer = undefined;
			throw error;
		});
	return tokenizer;
}

const MACRONS: Record<string, string> = {
	ā: "aa",
	ī: "ii",
	ū: "uu",
	ē: "ee",
	ō: "oo",
};

/** Hepburn, with ー written as the vowel again (コーヒー → koohii). */
const kanaToRomaji = (kana: string) =>
	toRomaji(kana, "hepburn")
		.trim()
		.replace(/[āīūēō]/g, (char) => MACRONS[char] ?? char);

const isKanaChar = (char: string) => /[぀-ゟ゠-ヿ]/.test(char);
const isKanji = (char: string) => /[㐀-䶿一-鿏豈-﫿々]/.test(char);
const hasJapanese = (text: string) =>
	Array.from(text).some((char) => isKanaChar(char) || isKanji(char));
const toKatakana = (text: string) =>
	text.replace(/[ぁ-ゖ]/g, (char) =>
		String.fromCharCode(char.charCodeAt(0) + 0x60),
	);

/**
 * Half-width katakana (ｿﾝﾅ) as the dictionary knows it (ソンナ), one
 * character for one, so every syllable keeps its length.
 */
const widenKatakana = (text: string) =>
	text.replace(/[｡-ﾟ]/g, (char) => {
		const wide = char.normalize("NFKC");
		return wide.length === 1 ? wide : char;
	});

interface Token {
	surface: string;
	/** Katakana as written, with particles as said. */
	reading: string;
	pos: string;
	posDetail: string;
	/** UTF-16 offset in the line. */
	position: number;
}

const known = (value: string | undefined) =>
	value && value !== "*" ? value : undefined;

/** The particles that aren't said as written. */
const PARTICLES: Record<string, string> = { は: "ワ", へ: "エ", を: "ヲ" };

function tokenize(tk: Tokenizer<IpadicFeatures>, text: string): Token[] {
	const tokens: Token[] = tk.tokenize(text).map((token) => {
		const surface = token.surface_form;
		const reading = known(token.reading);
		return {
			surface,
			reading:
				token.pos === "助詞" && PARTICLES[surface]
					? PARTICLES[surface]
					: !hasJapanese(surface)
						? surface
						: reading
							? toKatakana(reading)
							: Array.from(surface).every(isKanaChar)
								? toKatakana(surface)
								: surface,
			pos: token.pos,
			posDetail: token.pos_detail_1,
			position: token.word_position - 1,
		};
	});
	// A verb or adjective ending in っ takes the next token in (言っ|て → itte).
	for (let index = 0; index < tokens.length - 1; index++) {
		const token = tokens[index];
		if (
			(token.pos === "動詞" || token.pos === "形容詞") &&
			token.surface.length > 1 &&
			/[っッ]$/.test(token.surface)
		) {
			token.surface += tokens[index + 1].surface;
			token.reading += tokens[index + 1].reading;
			tokens.splice(index-- + 1, 1);
		}
	}
	return tokens;
}

const INFLECTING = new Set(["動詞", "形容詞", "助動詞"]);

/**
 * Endings that stay on the word before, the way Genius writes them: verb and
 * adjective endings (yonde, ita, ikou), て/で, and suffixes (tomodachisan).
 * A copula after a noun stays its own word (suki da).
 */
const attaches = (token: Token, previous: Token | undefined) =>
	(token.pos === "助動詞" && !!previous && INFLECTING.has(previous.pos)) ||
	(token.pos === "助詞" && token.posDetail === "接続助詞") ||
	token.posDetail === "接尾" ||
	// Casual ん (やってんの, 抜かしてんだ) is said as part of the word before.
	(!!previous && /^[んン]$/.test(token.surface)) ||
	// A ー on its own stretches the sound before it (せー → see).
	(!!previous && /^[ーｰ〜～]+$/.test(token.surface)) ||
	stretches(token, previous);

const VOWEL_KANA: Record<string, string> = {
	ア: "a",
	イ: "i",
	ウ: "u",
	エ: "e",
	オ: "o",
};

/** A lone vowel that holds the sound before it (うるせ|え → urusee). */
const stretches = (token: Token, previous: Token | undefined) => {
	const vowel = VOWEL_KANA[toKatakana(token.surface)];
	if (!vowel || !previous || !hasJapanese(previous.surface)) return false;
	return kanaToRomaji(previous.reading).slice(-1) === vowel;
};

/**
 * A reading in sounds, the units shared out between kanji: small kana, ー,
 * ン and ッ stay with the kana before them, so a kanji never starts with
 * one (千里眼 → セン|リ|ガン, 一歩 → イッ|ポ).
 */
const morae = (reading: string) => {
	const result: string[] = [];
	for (const char of reading) {
		if (result.length === 0 || !"ャュョァィゥェォヮーンッ".includes(char))
			result.push(char);
		else result[result.length - 1] += char;
	}
	return result;
};

/**
 * Shares a reading between characters by mora, the extra mora going to the
 * last (名前 → ナ|マエ); with fewer morae than characters, the first ones
 * get them, so nothing sung is left without a reading.
 */
const share = (reading: string, count: number) => {
	const parts = morae(reading);
	const cut = parts.length < count ? Math.round : Math.floor;
	return Array.from({ length: count }, (_, index) =>
		parts
			.slice(
				cut((index * parts.length) / count),
				cut(((index + 1) * parts.length) / count),
			)
			.join(""),
	);
};

const escapeRegExp = (text: string) =>
	text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

/**
 * One kana reading per character of a word. Kana read as themselves, and
 * each run of kanji takes the reading between them (走り出す → ハシ|リ|ダ|ス);
 * a run of several kanji shares its part by mora.
 */
export function charReadings(surface: string, reading?: string): string[] {
	const chars = surface.split("");
	if (!reading) return chars;
	const runs = surface.match(/[^぀-ゟ゠-ヿ]+|[぀-ゟ゠-ヿ]+/g) ?? [];
	const pattern = new RegExp(
		`^${runs
			.map((run) =>
				isKanaChar(run[0]) ? `(${escapeRegExp(toKatakana(run))})` : "(.+?)",
			)
			.join("")}$`,
	);
	const match = reading.match(pattern);
	if (!match) {
		// No clean alignment (an unusual reading): share it over the whole word.
		return share(reading, chars.length);
	}
	return runs.flatMap((run, index) =>
		isKanaChar(run[0])
			? toKatakana(run).split("")
			: share(match[index + 1], run.length),
	);
}

/**
 * Romanizes one line's syllables with the whole line as context, one entry
 * per syllable. A syllable that ends a word gets a trailing space, the word
 * gap the rest of the app expects.
 */
export function romanizeJapaneseLine(
	tk: Tokenizer<IpadicFeatures>,
	syllables: readonly string[],
): string[] {
	const text = widenKatakana(syllables.join(""));
	const owner = syllables.flatMap((syllable, index) =>
		Array.from({ length: syllable.length }, () => index),
	);
	const startsAt: number[] = [];
	let offset = 0;
	for (const syllable of syllables) {
		startsAt.push(offset);
		offset += syllable.length;
	}
	// Each syllable's kana, piece by piece, and whether the piece starts a word.
	const kana: Array<Array<{ piece: string; newWord: boolean }>> = syllables.map(
		() => [],
	);
	const startsWord = syllables.map(() => false);
	let lastReading: string | undefined;

	const tokens = tokenize(tk, text);
	tokens.forEach((token, tokenIndex) => {
		// Punctuation never starts a word ("Oh yeah, hashiridasu"), except an
		// opening quote or bracket, which leans on the word after it
		// (不条理『しかた → Fujouri "shikata).
		const newWord =
			tokenIndex > 0 &&
			(/^[「『（(“‘〈《【]$/.test(token.surface) ||
				(/[\p{L}\p{N}]/u.test(token.surface) &&
					!attaches(token, tokens[tokenIndex - 1])));
		if (newWord) {
			const syllable = startsAt.indexOf(token.position);
			if (syllable > 0) startsWord[syllable] = true;
		}
		// 々 the dictionary didn't read repeats the kanji before it (燦々 → san san).
		const readings =
			/^々+$/.test(token.surface) &&
			!isKanaChar(token.reading[0] ?? "") &&
			lastReading
				? token.surface.split("").map(() => lastReading as string)
				: hasJapanese(token.surface)
					? charReadings(token.surface, token.reading)
					: token.surface.split("");
		const lastKana = readings.filter(Boolean).pop();
		if (lastKana) lastReading = lastKana;
		const bySyllable = new Map<number, string>();
		readings.forEach((reading, index) => {
			const syllable = owner[token.position + index];
			bySyllable.set(syllable, (bySyllable.get(syllable) ?? "") + reading);
		});
		let first = true;
		for (const [syllable, piece] of bySyllable) {
			if (piece.trim())
				kana[syllable].push({ piece, newWord: first && newWord });
			first = false;
		}
	});

	const pieces = kana.flatMap((list, syllable) =>
		list.map((entry) => ({ syllable, ...entry })),
	);
	const romaji: Array<
		Array<{ text: string; newWord: boolean; opens: boolean }>
	> = syllables.map(() => []);
	let lastVowel = "";
	pieces.forEach(({ syllable, piece, newWord }, index) => {
		let text: string;
		if (piece === "ヲ") text = "wo";
		else if (!/[っッ]$/.test(piece)) text = kanaToRomaji(piece);
		else {
			// A っ ending a syllable keeps the consonant it doubles
			// (黙っ|て → damat|te); before a vowel, a pause or the line's end it
			// is unwritten.
			const next = pieces[index + 1]
				? kanaToRomaji(pieces[index + 1].piece)
				: "";
			const doubled = next.startsWith("ch")
				? "t"
				: /^[a-z]/i.test(next) && !/^[aeioun]/i.test(next)
					? next[0]
					: "";
			text = kanaToRomaji(piece.slice(0, -1)) + doubled;
		}
		// A ー split off into its own syllable holds the vowel before it
		// (セ|ー → se|e).
		text = text
			.replace(/^ー+/, (marks) => lastVowel.repeat(marks.length))
			.replace(/[『』]/g, '"')
			.replace(/〜/g, "~");
		const vowel = text.match(/[aeiou](?=[^a-z]*$)/i)?.[0];
		if (vowel) lastVowel = vowel.toLowerCase();
		romaji[syllable].push({
			text,
			newWord,
			// Opening brackets and quotes lean on the word after them.
			opens: /^[「『（(“‘〈《【]$/.test(piece.trim()),
		});
	});

	return romaji.map((list, index) => {
		// Inside one syllable (a line that isn't split yet), words still get gaps.
		const kept = list.filter((entry) => entry.text);
		const joined = kept
			.map((entry, position) =>
				position > 0 && entry.newWord && !kept[position - 1].opens
					? ` ${entry.text}`
					: entry.text,
			)
			.join("")
			.trim();
		if (!joined) return "";
		// A gap goes after this syllable when the next one that says anything
		// starts a new word, or the lyrics have a space here.
		let next = index + 1;
		while (
			next < syllables.length &&
			!startsWord[next] &&
			romaji[next].every((entry) => !entry.text)
		)
			next++;
		const gap =
			/\s$/.test(syllables[index]) ||
			(next < syllables.length &&
				startsWord[next] &&
				!kept[kept.length - 1]?.opens);
		return gap ? `${joined} ` : joined;
	});
}

/**
 * Where each Japanese word after the first starts in a text, as UTF-16
 * offsets: the same words the romanization puts gaps between (君|の|名前|を|
 * 呼んで|いた), punctuation staying with the word before it.
 */
export function japaneseWordStarts(
	tk: Tokenizer<IpadicFeatures>,
	text: string,
): Set<number> {
	const tokens = tokenize(tk, widenKatakana(text));
	const starts = new Set<number>();
	const opens = (token: Token | undefined) =>
		!!token && /^[「『（(“‘〈《【]$/.test(token.surface);
	tokens.forEach((token, index) => {
		const previous = tokens[index - 1];
		if (!previous) return;
		// An opening quote starts the word after it.
		if (opens(token)) starts.add(token.position);
		else if (
			/[\p{L}\p{N}]/u.test(token.surface) &&
			!opens(previous) &&
			!attaches(token, previous)
		)
			starts.add(token.position);
	});
	return starts;
}
