import type { LyricLine } from "$/types/ttml";

const isLatin = (text: string): boolean => /[A-Za-z]/.test(text);

export const normalizeWord = (text: string): string => {
	const cleaned = text
		.trim()
		.toLowerCase()
		.replace(/[^a-z']/g, "");
	return cleaned;
};

export const isEnglishWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return cleaned.length > 0 && /^[a-z']+$/.test(cleaned) && isLatin(cleaned);
};

export const isSpanishWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return (
		cleaned.length > 0 && /^[a-záéíóúñü]+$/.test(cleaned) && isLatin(cleaned)
	);
};

export const isFrenchWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return (
		cleaned.length > 0 &&
		/^[a-zàâäçéèêëïîôùûü]+$/.test(cleaned) &&
		isLatin(cleaned)
	);
};

export const isGermanWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return cleaned.length > 0 && /^[a-zäöüß]+$/.test(cleaned) && isLatin(cleaned);
};

export const isPortugueseWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return (
		cleaned.length > 0 &&
		/^[a-záéíóúàâãçêõ]+$/.test(cleaned) &&
		isLatin(cleaned)
	);
};

export const isPolishWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return (
		cleaned.length > 0 && /^[a-ząćęłńóśźż]+$/.test(cleaned) && isLatin(cleaned)
	);
};

export const isCzechWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return (
		cleaned.length > 0 &&
		/^[a-záčďéěíňóřšťúůýž]+$/.test(cleaned) &&
		isLatin(cleaned)
	);
};

export const isSlovakWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return (
		cleaned.length > 0 &&
		/^[a-záčďéěíňóřšťúýž]+$/.test(cleaned) &&
		isLatin(cleaned)
	);
};

export const isDanishWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return cleaned.length > 0 && /^[a-zæøå]+$/.test(cleaned) && isLatin(cleaned);
};

export const isRussianWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return cleaned.length > 0 && /^[а-яё]+$/.test(cleaned);
};

export const isIndonesianWord = (text: string): boolean => {
	const cleaned = normalizeWord(text);
	return cleaned.length > 0 && /^[a-z]+$/.test(cleaned) && isLatin(cleaned);
};

type LanguageCode =
	| "en"
	| "es"
	| "fr"
	| "de"
	| "pt"
	| "pl"
	| "cs"
	| "sk"
	| "da"
	| "ru"
	| "id"
	| "zh"
	| "auto";

const detectLanguageFromLine = (line: LyricLine): LanguageCode => {
	if (line.language && line.language !== "auto" && line.language !== "off") {
		const lang = line.language.toLowerCase();
		if (lang.startsWith("en")) return "en";
		if (lang.startsWith("es")) return "es";
		if (lang.startsWith("fr")) return "fr";
		if (lang.startsWith("de")) return "de";
		if (lang.startsWith("pt")) return "pt";
		if (lang.startsWith("pl")) return "pl";
		if (lang.startsWith("cs")) return "cs";
		if (lang.startsWith("sk")) return "sk";
		if (lang.startsWith("da")) return "da";
		if (lang.startsWith("ru")) return "ru";
		if (lang.startsWith("id")) return "id";
		if (lang.startsWith("zh")) return "zh";
	}
	return "auto";
};

const detectLanguageFromContent = (line: LyricLine): LanguageCode => {
	if (!line.words || line.words.length === 0) return "auto";

	let latinCount = 0;
	let cyrillicCount = 0;
	let cjkCount = 0;

	for (const word of line.words) {
		const text = word.word;
		if (/[a-zA-Z]/.test(text)) latinCount++;
		if (/[а-яёА-ЯЁ]/.test(text)) cyrillicCount++;
		if (/[\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff]/.test(text)) cjkCount++;
	}

	const total = line.words.length;
	if (cjkCount / total >= 0.4) return "zh";
	if (cyrillicCount / total >= 0.4) return "ru";

	const hasSpanishChars = /[áéíóúñü¿¡]/i.test(
		line.words.map((w) => w.word).join(" "),
	);
	const hasFrenchChars = /[àâäçéèêëïîôùûü]/i.test(
		line.words.map((w) => w.word).join(" "),
	);
	const hasGermanChars = /[äöüß]/i.test(
		line.words.map((w) => w.word).join(" "),
	);
	const hasPortugueseChars = /[ãõáéíóúàâçê]/i.test(
		line.words.map((w) => w.word).join(" "),
	);
	const hasPolishChars = /[ąćęłńóśźż]/i.test(
		line.words.map((w) => w.word).join(" "),
	);
	const hasCzechChars = /[áčďéěíňóřšťúůýž]/i.test(
		line.words.map((w) => w.word).join(" "),
	);
	const hasDanishChars = /[æøå]/i.test(line.words.map((w) => w.word).join(" "));

	if (hasSpanishChars) return "es";
	if (hasPortugueseChars) return "pt";
	if (hasFrenchChars) return "fr";
	if (hasGermanChars) return "de";
	if (hasPolishChars) return "pl";
	if (hasCzechChars) return "cs";
	if (hasDanishChars) return "da";

	if (latinCount / total >= 0.4) return "en";

	return "auto";
};

const getLineLanguage = (line: LyricLine): LanguageCode => {
	const explicitLang = detectLanguageFromLine(line);
	if (explicitLang !== "auto") return explicitLang;
	return detectLanguageFromContent(line);
};

interface AmbiguousWordPair {
	word: string;
	suggestions: string[];
	requiresContext?: boolean;
}

const ENGLISH_AMBIGUOUS_WORDS: AmbiguousWordPair[] = [
	{ word: "your", suggestions: ["you're"] },
	{ word: "youre", suggestions: ["your", "you're"] },
	{ word: "their", suggestions: ["they're", "there"] },
	{ word: "there", suggestions: ["their", "they're"] },
	{ word: "theyre", suggestions: ["their", "there"] },
	{ word: "its", suggestions: ["it's"] },
	{ word: "it's", suggestions: ["its"] },
	{ word: "then", suggestions: ["than"] },
	{ word: "than", suggestions: ["then"] },
	{ word: "alot", suggestions: ["a lot"] },
	{ word: "lose", suggestions: ["loose"] },
	{ word: "loose", suggestions: ["lose"] },
	{ word: "affect", suggestions: ["effect"] },
	{ word: "effect", suggestions: ["affect"] },
	{ word: "to", suggestions: ["too", "two"] },
	{ word: "too", suggestions: ["to", "two"] },
	{ word: "wear", suggestions: ["where"] },
	{ word: "where", suggestions: ["wear"] },
	{ word: "here", suggestions: ["hear"] },
	{ word: "hear", suggestions: ["here"] },
	{ word: "sea", suggestions: ["see"] },
	{ word: "see", suggestions: ["sea"] },
];

const SPANISH_AMBIGUOUS_WORDS: AmbiguousWordPair[] = [
	{ word: "por", suggestions: ["para"] },
	{ word: "para", suggestions: ["por"] },
	{ word: "mas", suggestions: ["más"] },
	{ word: "más", suggestions: ["mas"] },
	{ word: "este", suggestions: ["esta", "esto"] },
	{ word: "esta", suggestions: ["este", "esto"] },
	{ word: "esto", suggestions: ["este", "esta"] },
	{ word: "ese", suggestions: ["esa", "eso"] },
	{ word: "esa", suggestions: ["ese", "eso"] },
	{ word: "eso", suggestions: ["ese", "esa"] },
	{ word: "tener", suggestions: ["tener que"] },
	{ word: "hacer", suggestions: ["a hacer"] },
	{ word: "si", suggestions: ["sí"] },
	{ word: "sí", suggestions: ["si"] },
	{ word: "tu", suggestions: ["tú"] },
	{ word: "tú", suggestions: ["tu"] },
	{ word: "el", suggestions: ["él"] },
	{ word: "él", suggestions: ["el"] },
	{ word: "del", suggestions: ["de el"] },
	{ word: "solo", suggestions: ["sólo"] },
	{ word: "sólo", suggestions: ["solo"] },
	{ word: "aun", suggestions: ["aunque", "aún"] },
	{ word: "aún", suggestions: ["aun", "aunque"] },
	{ word: "aunque", suggestions: ["aun", "aún"] },
];

const FRENCH_AMBIGUOUS_WORDS: AmbiguousWordPair[] = [
	{ word: "son", suggestions: ["sont", "son", "sa"] },
	{ word: "sont", suggestions: ["son"] },
	{ word: "sa", suggestions: ["son", "ça"] },
	{ word: "ça", suggestions: ["sa"] },
	{ word: "se", suggestions: ["ce"] },
	{ word: "ce", suggestions: ["se", "c'est"] },
	{ word: "c'est", suggestions: ["ce"] },
	{ word: "peut", suggestions: ["peut-être"] },
	{ word: "peut-être", suggestions: ["peut"] },
	{ word: "plus", suggestions: ["plus"] },
	{ word: "peu", suggestions: ["peux", "peut"] },
	{ word: "ai", suggestions: ["a", "ais"] },
	{ word: "a", suggestions: ["ai", "as"] },
	{ word: "est", suggestions: ["et", "es", "était"] },
	{ word: "et", suggestions: ["est"] },
	{ word: "on", suggestions: ["ont"] },
	{ word: "ont", suggestions: ["on"] },
	{ word: "dont", suggestions: ["donc"] },
	{ word: "donc", suggestions: ["dont"] },
];

const GERMAN_AMBIGUOUS_WORDS: AmbiguousWordPair[] = [
	{ word: "das", suggestions: ["dass"] },
	{ word: "dass", suggestions: ["das"] },
	{ word: "zu", suggestions: ["zum", "zur"] },
	{ word: "zum", suggestions: ["zu"] },
	{ word: "zur", suggestions: ["zu"] },
	{ word: "von", suggestions: ["vom"] },
	{ word: "vom", suggestions: ["von"] },
	{ word: "dann", suggestions: ["denn"] },
	{ word: "denn", suggestions: ["dann"] },
	{ word: "wenn", suggestions: ["als"] },
	{ word: "als", suggestions: ["wenn"] },
	{ word: "sei", suggestions: ["sey", "seid"] },
	{ word: "ist", suggestions: ["es", "sind"] },
	{ word: "es", suggestions: ["ist", "das"] },
	{ word: "sind", suggestions: ["ist"] },
	{ word: "hat", suggestions: ["hatte", "haben"] },
	{ word: "hatte", suggestions: ["hat"] },
	{ word: "haben", suggestions: ["hat"] },
	{ word: "wird", suggestions: ["wurde"] },
	{ word: "wurde", suggestions: ["wird"] },
];

const PORTUGUESE_AMBIGUOUS_WORDS: AmbiguousWordPair[] = [
	{ word: "para", suggestions: ["por", "a"] },
	{ word: "por", suggestions: ["para"] },
	{ word: "mas", suggestions: ["mais"] },
	{ word: "mais", suggestions: ["mas"] },
	{ word: "esse", suggestions: ["essa", "isso"] },
	{ word: "essa", suggestions: ["esse", "isso"] },
	{ word: "isso", suggestions: ["esse", "essa"] },
	{ word: "este", suggestions: ["esta", "isto"] },
	{ word: "esta", suggestions: ["este", "isto"] },
	{ word: "isto", suggestions: ["este", "esta"] },
	{ word: "se", suggestions: ["é"] },
	{ word: "é", suggestions: ["se"] },
	{ word: "já", suggestions: ["ja"] },
	{ word: "ja", suggestions: ["já"] },
	{ word: "tu", suggestions: ["você"] },
	{ word: "você", suggestions: ["tu"] },
	{ word: "tem", suggestions: ["têm", "tem"] },
	{ word: "têm", suggestions: ["tem"] },
	{ word: "vem", suggestions: ["vêm", "vem"] },
	{ word: "vêm", suggestions: ["vem"] },
];

const POLISH_AMBIGUOUS_WORDS: AmbiguousWordPair[] = [
	{ word: "to", suggestions: ["też", "tej"] },
	{ word: "też", suggestions: ["to", "tez"] },
	{ word: "tez", suggestions: ["też"] },
	{ word: "w", suggestions: ["we"] },
	{ word: "we", suggestions: ["w"] },
	{ word: "z", suggestions: ["ze", "za"] },
	{ word: "ze", suggestions: ["z"] },
	{ word: "za", suggestions: ["z"] },
	{ word: "i", suggestions: ["i"] },
	{ word: "lub", suggestions: ["albo"] },
	{ word: "albo", suggestions: ["lub"] },
	{ word: "ani", suggestions: ["ani"] },
	{ word: "jest", suggestions: ["są"] },
	{ word: "są", suggestions: ["jest"] },
	{ word: "był", suggestions: ["była", "było"] },
	{ word: "była", suggestions: ["był", "było"] },
	{ word: "było", suggestions: ["był", "była"] },
];

const getAmbiguousWords = (language: LanguageCode): AmbiguousWordPair[] => {
	switch (language) {
		case "es":
			return SPANISH_AMBIGUOUS_WORDS;
		case "fr":
			return FRENCH_AMBIGUOUS_WORDS;
		case "de":
			return GERMAN_AMBIGUOUS_WORDS;
		case "pt":
			return PORTUGUESE_AMBIGUOUS_WORDS;
		case "pl":
			return POLISH_AMBIGUOUS_WORDS;
		default:
			return ENGLISH_AMBIGUOUS_WORDS;
	}
};

const normalizeForLanguage = (text: string, language: LanguageCode): string => {
	const cleaned = text.trim().toLowerCase();

	switch (language) {
		case "es":
			return cleaned.replace(/[áéíóúñü¿¡]/g, (c) =>
				"áéíóúñü".includes(c) ? c : "aeiou".charAt("áéíóú".indexOf(c)),
			);
		case "fr":
			return cleaned.replace(/[àâäçéèêëïîôùûü]/g, (c) => c);
		case "de":
			return cleaned.replace(/[äöüß]/g, (c) =>
				"äöü".includes(c) ? c : "aou".charAt("äöü".indexOf(c)),
			);
		case "pt":
			return cleaned.replace(/[ãõáéíóúàâçê]/g, (c) => c);
		case "pl":
			return cleaned.replace(/[ąćęłńóśźż]/g, (c) => c);
		case "cs":
		case "sk":
			return cleaned.replace(/[áčďéěíňóřšťúůýž]/g, (c) => c);
		case "da":
			return cleaned.replace(/[æøå]/g, (c) => c);
		case "ru":
			return cleaned.replace(/[ёЁ]/g, (c) => (c === "ё" ? "е" : "Е"));
		default:
			return cleaned.replace(/[^a-z']/g, "");
	}
};

export const collectPossibleGrammarWarnings = (
	line: LyricLine,
	ignoredWords: Set<string>,
): Set<string> => {
	const warnings = new Set<string>();
	const language = getLineLanguage(line);

	for (let i = 0; i < line.words.length; i++) {
		const wordObj = line.words[i];
		const current = normalizeForLanguage(wordObj.word, language);
		if (!current || ignoredWords.has(current)) continue;

		if (i > 0) {
			const prevRaw = line.words[i - 1].word;
			const currentRaw = wordObj.word;
			const prev = normalizeForLanguage(prevRaw, language);
			if (prev && current === prev) {
				const hasSpaceBetween = /\s$/.test(prevRaw) || /^\s/.test(currentRaw);
				const hasPunctuationBetween =
					/[.,!?;:]$/.test(prevRaw.trim()) ||
					/^[.,!?;:]/.test(currentRaw.trim());
				if (hasSpaceBetween || hasPunctuationBetween) {
					warnings.add(line.words[i - 1].id);
					warnings.add(wordObj.id);
				}
			}
		}

		const ambiguousWords = getAmbiguousWords(language);
		const normalizedForCheck = normalizeForLanguage(wordObj.word, "en");
		for (const amb of ambiguousWords) {
			if (current === amb.word || normalizedForCheck === amb.word) {
				warnings.add(wordObj.id);
				break;
			}
		}

		if (i === 0 && !warnings.has(wordObj.id)) {
			const firstAlphaIndex = wordObj.word.search(/[a-zA-Zа-яёÁ-ЯЁ]/);
			if (firstAlphaIndex !== -1) {
				const char = wordObj.word[firstAlphaIndex];
				const isUpperCase =
					language === "ru"
						? char === char.toUpperCase() && /[А-ЯЁ]/.test(char)
						: char === char.toUpperCase() && /[A-Z]/.test(char);
				if (!isUpperCase) {
					warnings.add(wordObj.id);
				}
			}
		}

		if (i === line.words.length - 1 && !warnings.has(wordObj.id)) {
			const rawWord = wordObj.word.trim();
			if (rawWord.endsWith(".") || rawWord.endsWith(",")) {
				warnings.add(wordObj.id);
			}
		}

		// Cross-token em-dash bridging: flag em-dash that crosses to the next word
		if (i < line.words.length - 1) {
			const currentWord = line.words[i].word;
			const nextWord = line.words[i + 1].word;
			if (
				currentWord.endsWith("—") &&
				nextWord &&
				/^[A-Za-z]/.test(nextWord[0])
			) {
				warnings.add(line.words[i].id);
				warnings.add(line.words[i + 1].id);
			}
			// Also handle case where dash occurs across token boundary (e.g., "God—stained" split)
			if (
				currentWord.includes("—") &&
				nextWord &&
				/^[A-Za-z]/.test(nextWord[0])
			) {
				warnings.add(line.words[i].id);
				warnings.add(line.words[i + 1].id);
			}
		}

		if (!warnings.has(wordObj.id)) {
			const rawWord = wordObj.word.trim();
			if (rawWord === "—") {
				warnings.add(wordObj.id);
			}
		}

		if (!warnings.has(wordObj.id)) {
			const rawWord = wordObj.word;
			const hasEmDash = rawWord.includes("—");
			const endsWithEmDash = rawWord.endsWith("—");
			if (hasEmDash && !endsWithEmDash) {
				warnings.add(wordObj.id);
			}
		}

		if (!warnings.has(wordObj.id)) {
			const rawWord = wordObj.word;
			const isLastWord = i === line.words.length - 1;
			if (isLastWord && /^.+-$/.test(rawWord) && !/[^a-zA-Z]-/.test(rawWord)) {
				warnings.add(wordObj.id);
			}
		}
	}

	return warnings;
};

export const getGrammarSuggestions = (
	line: LyricLine,
	wordIndex: number,
	_allWordsInLyrics?: Set<string>,
): string[] => {
	const suggestions: string[] = [];
	const word = line.words[wordIndex];
	if (!word) return suggestions;

	const language = getLineLanguage(line);
	const current = normalizeForLanguage(word.word, language);

	const firstAlphaIndex = word.word.search(/[a-zA-Zа-яёÁ-ЯЁ]/);
	if (wordIndex === 0 && firstAlphaIndex !== -1) {
		const char = word.word[firstAlphaIndex];
		const isUpperCase =
			language === "ru"
				? char === char.toUpperCase() && /[А-ЯЁ]/.test(char)
				: char === char.toUpperCase() && /[A-Z]/.test(char);
		if (!isUpperCase) {
			let capitalized: string;
			if (language === "ru") {
				capitalized =
					word.word.slice(0, firstAlphaIndex) +
					char.toUpperCase() +
					word.word.slice(firstAlphaIndex + 1);
			} else {
				capitalized =
					word.word.slice(0, firstAlphaIndex) +
					char.toUpperCase() +
					word.word.slice(firstAlphaIndex + 1);
			}
			suggestions.push(capitalized);
		}
	}

	const ambiguousWords = getAmbiguousWords(language);
	for (const amb of ambiguousWords) {
		if (current === amb.word) {
			suggestions.push(...amb.suggestions);
			break;
		}
	}

	const normalizedForCheck = normalizeForLanguage(word.word, "en");
	if (normalizedForCheck === "a" || normalizedForCheck === "an") {
		const nextWord = line.words[wordIndex + 1]?.word;
		const next = normalizeForLanguage(nextWord || "", "en");
		if (next) {
			const startsWithVowel = /^[aeiou]/.test(next);
			if (normalizedForCheck === "a" && startsWithVowel) {
				suggestions.push("an");
			} else if (normalizedForCheck === "an" && !startsWithVowel) {
				suggestions.push("a");
			}
		}
	}

	if (wordIndex > 0) {
		const prevRaw = line.words[wordIndex - 1].word;
		const currentRaw = word.word;
		const prev = normalizeForLanguage(prevRaw, language);
		if (prev && current === prev) {
			const hasSpaceBetween = /\s$/.test(prevRaw) || /^\s/.test(currentRaw);
			const hasPunctuationBetween =
				/[.,!?;:]$/.test(prevRaw.trim()) || /^[.,!?;:]/.test(currentRaw.trim());
			if (hasSpaceBetween || hasPunctuationBetween) {
				suggestions.push("__REMOVE_REPEATED_WORD__");
			}
		}
	}

	if (wordIndex === line.words.length - 1) {
		const rawWord = word.word.trim();
		if (rawWord.endsWith(".") || rawWord.endsWith(",")) {
			suggestions.push(rawWord.slice(0, -1).trim());
		}
	}

	if (word.word.trim() === "—") {
		suggestions.push("–");
	}

	const trimmedWord = word.word;
	const hasEmDash = trimmedWord.includes("—");
	const endsWithEmDash = trimmedWord.endsWith("—");
	if (hasEmDash && !endsWithEmDash) {
		suggestions.push(trimmedWord.replace("—", "-"));
	}

	const isLastWord = wordIndex === line.words.length - 1;
	if (
		isLastWord &&
		/^.+-$/.test(trimmedWord) &&
		!/[^a-zA-Z]-/.test(trimmedWord)
	) {
		suggestions.push(trimmedWord.slice(0, -1) + "—");
	}

	const result = [...new Set(suggestions)];

	if (wordIndex === 0) {
		return result.map((s) => {
			if (s.startsWith("__")) return s;
			const firstAlpha = s.search(/[a-zA-Zа-яёÁ-ЯЁ]/);
			if (firstAlpha !== -1) {
				if (language === "ru") {
					return (
						s.slice(0, firstAlpha) +
						s[firstAlpha].toUpperCase() +
						s.slice(firstAlpha + 1)
					);
				}
				return (
					s.slice(0, firstAlpha) +
					s[firstAlpha].toUpperCase() +
					s.slice(firstAlpha + 1)
				);
			}
			return s;
		});
	}

	return result;
};

export const collectWarningsWithSuggestions = (
	line: LyricLine,
	ignoredWords: Set<string>,
	_allWordsInLyrics?: Set<string>,
): Set<string> => {
	const rawWarnings = collectPossibleGrammarWarnings(line, ignoredWords);
	if (rawWarnings.size === 0) return rawWarnings;

	const filteredWarnings = new Set<string>();
	for (const wordId of rawWarnings) {
		const wordIndex = line.words.findIndex((w) => w.id === wordId);
		if (wordIndex !== -1) {
			const suggestions = getGrammarSuggestions(
				line,
				wordIndex,
				_allWordsInLyrics,
			);
			if (suggestions.length > 0) {
				filteredWarnings.add(wordId);
			}
		}
	}
	return filteredWarnings;
};
