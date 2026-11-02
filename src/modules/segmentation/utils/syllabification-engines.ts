import nlp from "compromise/tokenize";
import nlpSpeech from "compromise-speech";
import silabas from "silabas";
import syllabify from "syllabify";
import syllabifyFr from "syllabify-fr";
import prosodicDictionary from "../data/prosodic-dict.json";
import type { SegmentationEngineId } from "../types";

type DictionaryEntry = number | number[];

export interface SyllabificationEngine {
	id: SegmentationEngineId;
	name: string;
	description: string;
	split: (word: string) => string[];
}

const hyphenationLanguages = [
	["en-us", "English (US)", true],
	["de", "German", false],
	["fr", "French", true],
	["es", "Spanish", true],
	["id", "Indonesian", false],
	["it", "Italian", false],
	["pt", "Portuguese", false],
	["ru", "Russian", true],
	["pl", "Polish", false],
] as const;

export const getHyphenationLanguage = (engine: SegmentationEngineId) =>
	engine.startsWith("hyphenation-")
		? engine.slice("hyphenation-".length)
		: undefined;

const dictionary = new Map<string, DictionaryEntry>(
	Object.entries(prosodicDictionary as Record<string, DictionaryEntry>),
);
const nlpWithSpeech = nlp.extend(nlpSpeech as never);

const splitAtLengths = (word: string, lengths: number[]) => {
	const boundaries = lengths.reduce<number[]>((result, length) => {
		result.push((result[result.length - 1] ?? 0) + length);
		return result;
	}, []);
	const parts: string[] = [];
	let start = 0;
	for (const end of boundaries) {
		parts.push(word.slice(start, end));
		start = end;
	}
	parts.push(word.slice(start));
	return parts.filter(Boolean);
};

const compromiseSplit = (word: string) => {
	const syllables = (nlpWithSpeech(word).syllables() as string[][]).flat();
	if (syllables.length <= 1) return [word];

	let offset = 0;
	const intervals = syllables.map((syllable) => {
		const remaining = word.slice(offset);
		const match = remaining.toLowerCase().indexOf(syllable.toLowerCase());
		const end = offset + (match < 0 ? 0 : match) + syllable.length;
		const begin = offset;
		offset = end;
		return { begin, end };
	});

	for (let index = 0; index < intervals.length; index++) {
		const interval = intervals[index];
		if (index === intervals.length - 1) {
			interval.end = word.length;
			continue;
		}
		const next = intervals[index + 1];
		interval.end = next.begin;
		if (/[’']/.test(word.charAt(interval.end - 1))) {
			interval.end--;
			next.begin--;
		}
	}
	return intervals
		.map(({ begin, end }) => word.slice(begin, end))
		.filter(Boolean);
};

const mergeContractionSuffix = (parts: string[]) => {
	const result: string[] = [];
	for (const part of parts) {
		if (/^[’'](?:s|re|ve|ll|d|m|t)$/i.test(part) && result.length > 0) {
			result[result.length - 1] += part;
		} else {
			result.push(part);
		}
	}
	return result;
};

const prosodicSplit = (word: string) => {
	const key = word.toLowerCase();
	const entry =
		dictionary.get(key) ??
		(key.endsWith("in") ? dictionary.get(`${key}g`) : undefined);
	if (entry !== undefined) {
		return splitAtLengths(word, typeof entry === "number" ? [entry] : entry);
	}
	return mergeContractionSuffix(compromiseSplit(word));
};

export const SYLLABIFICATION_ENGINES: SyllabificationEngine[] = [
	{
		id: "prosodic",
		name: "English (Prosodic)",
		description:
			"Dictionary-backed English syllable boundaries with a speech fallback.",
		split: prosodicSplit,
	},
	{
		id: "basic",
		name: "Basic",
		description:
			"Keep Latin words whole and split CJK text using the existing rules.",
		split: (word) => [word],
	},
	{
		id: "silabas",
		name: "Spanish (Silabas)",
		description: "Spanish orthographic syllable splitting.",
		split: (word) => {
			try {
				return silabas(word).syllables();
			} catch {
				return [word];
			}
		},
	},
	{
		id: "syllabify-fr",
		name: "French (Syllabify-fr)",
		description: "French orthographic syllable splitting.",
		split: (word) => syllabifyFr(word).syllabes,
	},
	{
		id: "syllabify",
		name: "Russian (Syllabify)",
		description: "Russian orthographic syllable splitting.",
		split: (word) => {
			try {
				return syllabify(word);
			} catch {
				return [word];
			}
		},
	},
	...hyphenationLanguages.map<SyllabificationEngine>(
		([language, name, hasBetterEngine]) => ({
			id: `hyphenation-${language}`,
			name: `${name}${hasBetterEngine ? " (legacy)" : ""}`,
			description: `Use the existing ${name} hyphenation patterns.`,
			split: (word) => [word],
		}),
	),
	{
		id: "none",
		name: "None",
		description: "Do not split words automatically.",
		split: (word) => [word],
	},
];
SYLLABIFICATION_ENGINES.sort((left, right) =>
	left.name.localeCompare(right.name),
);

export const getSyllabificationEngine = (id: SegmentationEngineId) =>
	SYLLABIFICATION_ENGINES.find((engine) => engine.id === id) ??
	SYLLABIFICATION_ENGINES[0];
