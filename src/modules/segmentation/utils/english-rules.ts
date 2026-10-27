/**
 * Rule-based English syllable splitting, no dictionary. Finds vowel nuclei,
 * gives each consonant cluster between them the longest legal onset, peels
 * common suffixes, splits known compounds and checks a short exception list.
 * Splits keep readable spelling: "hap|py", "danc|ing", "want|ed", "ta|ble".
 */

/** Irregular words, as "syl|la|bles". */
const EXCEPTIONS: Record<string, string> = {
	any: "an|y",
	many: "man|y",
	ever: "ev|er",
	never: "nev|er",
	every: "ev|ery",
	people: "peo|ple",
	hundred: "hun|dred",
	naked: "na|ked",
	wicked: "wick|ed",
	sacred: "sa|cred",
	kindred: "kin|dred",
	crooked: "crook|ed",
	rugged: "rug|ged",
	beloved: "be|lov|ed",
	react: "re|act",
	reaction: "re|ac|tion",
	realize: "re|al|ize",
	reality: "re|al|i|ty",
	forget: "for|get",
	forgive: "for|give",
	forgot: "for|got",
	forgotten: "for|got|ten",
	business: "busi|ness",
	nothing: "noth|ing",
};

/** Free-standing parts that split a compound when both halves are listed. */
const COMPOUND_PARTS = new Set([
	"some",
	"any",
	"every",
	"no",
	"thing",
	"body",
	"one",
	"where",
	"self",
	"selves",
	"night",
	"day",
	"time",
	"sun",
	"shine",
	"heart",
	"beat",
	"break",
	"out",
	"side",
	"in",
	"good",
	"bye",
	"my",
	"your",
	"him",
	"her",
	"them",
	"our",
	"it",
	"home",
	"made",
	"fire",
	"work",
	"works",
	"light",
	"mare",
	"rain",
	"bow",
	"snow",
	"base",
	"ball",
	"down",
	"up",
	"ever",
	"what",
	"how",
	"when",
	"for",
	"who",
]);

const VOWELS = "aeiou";
const isVowelLetter = (char: string | undefined) =>
	!!char && VOWELS.includes(char);

/** Vowel pairs that are two syllables ("li|on", "po|em"). */
const HIATUS_PAIRS = new Set(["ia", "io", "iu", "eo", "ua", "uo", "oe"]);
const DIGRAPHS = ["tch", "th", "sh", "ch", "ph", "wh", "gh", "ck", "ng", "qu"];
const NEVER_ONSET = new Set(["x", "ck", "gh", "ng"]);
const LEGAL_ONSETS = new Set([
	"bl",
	"br",
	"cl",
	"cr",
	"dr",
	"fl",
	"fr",
	"gl",
	"gr",
	"pl",
	"pr",
	"sc",
	"sk",
	"sl",
	"sm",
	"sn",
	"sp",
	"st",
	"sw",
	"tr",
	"tw",
	"thr",
	"shr",
	"phr",
	"chr",
	"spl",
	"spr",
	"str",
	"scr",
	"squ",
	"sch",
]);
/** Stem-final doubled letters that stay together before a suffix ("kiss|es"). */
const KEEP_DOUBLE = new Set(["ll", "ss", "ff", "zz"]);

const hasVowel = (text: string) => /[aeiouy]/.test(text);

/** Marks which letters are vowel nuclei, after English spelling adjustments. */
function vowelMask(word: string): boolean[] {
	const mask = Array.from(word, (char, index) => {
		if (isVowelLetter(char)) return true;
		if (char !== "y") return false;
		// "y" before a vowel is a consonant ("yellow", "be|yond").
		return index > 0 && !isVowelLetter(word[index + 1]);
	});
	for (let index = 0; index < word.length; index++) {
		const char = word[index];
		const prev = word[index - 1];
		const next = word[index + 1];
		// "qu" and "gu" + vowel: the u is part of the consonant.
		if (char === "u" && (prev === "q" || (prev === "g" && isVowelLetter(next))))
			mask[index] = false;
		// "tion", "cial", "ocean", "pigeon": the i or e only colours the consonant.
		if (
			(char === "i" &&
				/[tcsxg]/.test(prev ?? "") &&
				/[aou]/.test(next ?? "")) ||
			(char === "e" && /[cg]/.test(prev ?? "") && /[ao]/.test(next ?? ""))
		) {
			if (index > 1) mask[index] = false;
		}
	}
	// Silent final e: "time", "fire", "be|cause"; but not "be", "free", "Cle".
	const last = word.length - 1;
	if (
		word[last] === "e" &&
		!isVowelLetter(word[last - 1]) &&
		!(word[last - 1] === "l" && !isVowelLetter(word[last - 2])) &&
		mask.slice(0, last - 1).some(Boolean)
	) {
		mask[last] = false;
	}
	return mask;
}

/** Splits a vowel run into nuclei at hiatus pairs. Returns run start offsets. */
function splitVowelRun(word: string, start: number, end: number): number[] {
	const starts = [start];
	for (let index = start; index < end - 1; index++) {
		const pair = word.slice(index, index + 2);
		const after = word.slice(index + 2);
		const atEnd = index + 2 === word.length;
		const isHiatus =
			(HIATUS_PAIRS.has(pair) && !(pair === "oe" && atEnd)) ||
			(pair === "ea" && (atEnd || after === "te" || after === "ted")) ||
			(pair === "ie" && /^(t|nc|nt)/.test(after)) ||
			(pair === "ui" && /^[nd]/.test(after)) ||
			(pair === "ue" && /^l/.test(after));
		if (isHiatus) starts.push(index + 1);
	}
	return starts;
}

/** Breaks a consonant cluster into units, keeping digraphs whole. */
function consonantUnits(cluster: string): string[] {
	const units: string[] = [];
	for (let index = 0; index < cluster.length; ) {
		const digraph = DIGRAPHS.find((candidate) =>
			cluster.startsWith(candidate, index),
		);
		const unit = digraph ?? cluster[index];
		units.push(unit);
		index += unit.length;
	}
	return units;
}

/** How many leading units of the cluster stay as the previous syllable's coda. */
function codaLength(units: string[], beforeEr: boolean): number {
	const count = units.length;
	if (count === 0) return 0;
	if (count === 1) {
		if (NEVER_ONSET.has(units[0])) return 1;
		// "moth|er", "teach|er": a digraph before final -er stays as coda.
		if (beforeEr && units[0].length > 1) return 1;
		return 0;
	}
	if (units[count - 2] === units[count - 1]) return count - 1;
	if (count === 2 && units[0] === "s" && /^[ptkc]$/.test(units[1])) return 1;
	for (let size = Math.min(3, count); size > 1; size--) {
		const onset = units.slice(count - size).join("");
		if (LEGAL_ONSETS.has(onset)) return count - size;
	}
	return NEVER_ONSET.has(units[count - 1]) ? count : count - 1;
}

/** Syllable boundaries (offsets) for a lowercase letters-only word. */
function coreBoundaries(word: string): number[] {
	const mask = vowelMask(word);
	const nuclei: Array<{ start: number; end: number }> = [];
	for (let index = 0; index < word.length; ) {
		if (!mask[index]) {
			index++;
			continue;
		}
		let end = index;
		while (end < word.length && mask[end]) end++;
		const starts = splitVowelRun(word, index, end);
		starts.forEach((start, runIndex) => {
			nuclei.push({ start, end: starts[runIndex + 1] ?? end });
		});
		index = end;
	}
	const boundaries: number[] = [];
	for (let index = 1; index < nuclei.length; index++) {
		const clusterStart = nuclei[index - 1].end;
		const clusterEnd = nuclei[index].start;
		// Glide vowels ("na|tion", "o|cean") open the next syllable.
		let consonantEnd = clusterEnd;
		while (consonantEnd > clusterStart && isVowelLetter(word[consonantEnd - 1]))
			consonantEnd--;
		const units = consonantUnits(word.slice(clusterStart, consonantEnd));
		const beforeEr =
			index === nuclei.length - 1 && word.slice(clusterEnd) === "er";
		const coda = codaLength(units, beforeEr);
		boundaries.push(
			clusterStart + units.slice(0, coda).reduce((sum, u) => sum + u.length, 0),
		);
	}
	return boundaries;
}

const LETTER_SUFFIXES = ["ness", "less", "ment", "ful", "ly", "ty"];

/** Parts for a lowercase letters-only word, with suffix and compound rules. */
function syllabifyLower(word: string, allowCompound = true): string[] {
	if (word.length <= 2 || !hasVowel(word)) return [word];
	const exception = EXCEPTIONS[word];
	if (exception) return exception.split("|");

	if (allowCompound) {
		for (let index = 2; index <= word.length - 2; index++) {
			const head = word.slice(0, index);
			const tail = word.slice(index);
			if (COMPOUND_PARTS.has(head) && COMPOUND_PARTS.has(tail)) {
				return [...syllabifyLower(head, false), ...syllabifyLower(tail, false)];
			}
		}
	}

	// Consonant + le: "ta|ble", "lit|tle", "tick|le", "trou|bled".
	const cle = /([b-df-hj-np-tv-z])le([sd]?)$/.exec(word);
	if (cle && hasVowel(word.slice(0, cle.index))) {
		if (word.slice(cle.index - 1, cle.index + 1) === "ck") {
			return [
				...syllabifyLower(word.slice(0, cle.index + 1), false),
				`le${cle[2]}`,
			];
		}
		const stem = word.slice(0, cle.index);
		return [...syllabifyLower(stem, false), word.slice(cle.index)];
	}

	if (word.length > 4 && word.endsWith("ing") && hasVowel(word.slice(0, -3))) {
		let stem = word.slice(0, -3);
		let onset = "";
		const double = stem.slice(-2);
		if (
			double[0] === double[1] &&
			!KEEP_DOUBLE.has(double) &&
			!isVowelLetter(double[0])
		) {
			onset = stem.slice(-1);
			stem = stem.slice(0, -1);
		}
		return [...syllabifyLower(stem, false), `${onset}ing`];
	}

	if (word.length > 3 && word.endsWith("ed") && hasVowel(word.slice(0, -2))) {
		const stem = word.slice(0, -2);
		const parts = syllabifyLower(stem, false);
		if (/[td]$/.test(stem)) return [...parts, "ed"];
		parts[parts.length - 1] += "ed";
		return parts;
	}

	if (word.length > 3 && word.endsWith("es") && hasVowel(word.slice(0, -2))) {
		const stem = word.slice(0, -2);
		const parts = syllabifyLower(stem, false);
		if (/(?:[sxzcg]|ch|sh)$/.test(stem)) return [...parts, "es"];
		parts[parts.length - 1] += "es";
		return parts;
	}

	for (const suffix of LETTER_SUFFIXES) {
		const stem = word.slice(0, -suffix.length);
		if (
			word.length > suffix.length + 2 &&
			word.endsWith(suffix) &&
			hasVowel(stem)
		) {
			return [...syllabifyLower(stem, false), suffix];
		}
	}

	const parts: string[] = [];
	let start = 0;
	for (const boundary of coreBoundaries(word)) {
		parts.push(word.slice(start, boundary));
		start = boundary;
	}
	parts.push(word.slice(start));
	return parts.filter(Boolean);
}

/** Cuts the original word at the lengths of the lowercase parts. */
const sliceLike = (original: string, parts: string[]) => {
	const result: string[] = [];
	let offset = 0;
	for (const part of parts) {
		result.push(original.slice(offset, offset + part.length));
		offset += part.length;
	}
	return result;
};

/**
 * Splits one English word into syllables. Returns `null` for anything that is
 * not plain ASCII letters (with apostrophes), so callers can fall back.
 */
export function splitEnglishByRules(word: string): string[] | null {
	const lower = word.toLowerCase();
	if (!/^[a-z'’]+$/.test(lower) || !/[a-z]/.test(lower)) return null;

	// Dropped g: "singin'" splits like "singing".
	const droppedG = /in['’]$/.test(lower) ? `${lower.slice(0, -1)}g` : undefined;
	if (droppedG && !/['’]/.test(droppedG)) {
		return sliceLike(word, syllabifyLower(droppedG));
	}

	const contraction = /^(.*?)(n['’]t|['’](?:s|re|ve|ll|d|m|t))$/.exec(lower);
	if (contraction && /[a-z]/.test(contraction[1])) {
		const [, stem, suffix] = contraction;
		if (/['’]/.test(stem)) return [word];
		const parts = syllabifyLower(stem);
		const separate =
			suffix.startsWith("n") &&
			!isVowelLetter(stem[stem.length - 1]) &&
			hasVowel(stem);
		if (separate) parts.push(suffix);
		else parts[parts.length - 1] += suffix;
		return sliceLike(word, parts);
	}

	if (/['’]/.test(lower)) return [word];
	return sliceLike(word, syllabifyLower(lower));
}
