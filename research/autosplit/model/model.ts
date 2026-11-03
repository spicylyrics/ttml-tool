/**
 * A per-cut model for sung-syllable splits: for every gap between two letters
 * it gives the probability that a singer cuts there. Logistic regression over
 * hashed letter-window features. No dependencies, so the same code can run in
 * the editor later.
 */

const VOWELS = "aeiouyàâäéèêëïîôöùûü";
const isVowel = (c: string | undefined) => !!c && VOWELS.includes(c);

/** Cut positions (string indexes) of a split like `ba/by` -> [2]. */
export function cutsOf(split: string) {
	const cuts: number[] = [];
	let offset = 0;
	for (const part of split.split("/").slice(0, -1)) {
		offset += part.length;
		cuts.push(offset);
	}
	return cuts;
}

export function splitAt(word: string, cuts: Iterable<number>) {
	let out = "";
	let start = 0;
	for (const end of [...cuts].sort((a, b) => a - b)) {
		out += `${word.slice(start, end)}/`;
		start = end;
	}
	return out + word.slice(start);
}

/** Letter class used in shape features: V vowel, C consonant, ' apostrophe. */
const shapeOf = (c: string | undefined) =>
	c === undefined
		? "#"
		: isVowel(c)
			? "V"
			: c === "'"
				? "'"
				: /\p{L}/u.test(c)
					? "C"
					: "?";

/**
 * Features of the gap before index `i` of `word` (lowercase). With `ruleCuts`
 * (the rules' split), the model also sees whether the rules cut here, so it
 * learns when to overrule them instead of relearning them.
 */
export function gapFeatures(
	word: string,
	i: number,
	ruleCuts?: Set<number>,
): string[] {
	const at = (k: number) => (k < 0 ? "^" : k >= word.length ? "$" : word[k]);
	const f: string[] = ["bias"];
	for (let k = -3; k <= 2; k++) f.push(`c${k}=${at(i + k)}`);
	f.push(`l2=${at(i - 2)}${at(i - 1)}`, `r2=${at(i)}${at(i + 1)}`);
	f.push(`m=${at(i - 1)}|${at(i)}`);
	f.push(
		`l3=${at(i - 3)}${at(i - 2)}${at(i - 1)}`,
		`r3=${at(i)}${at(i + 1)}${at(i + 2)}`,
	);
	f.push(`m2=${at(i - 2)}${at(i - 1)}|${at(i)}${at(i + 1)}`);
	let shape = "";
	for (let k = -3; k <= 2; k++) {
		const idx = i + k;
		shape += idx < 0 || idx >= word.length ? "#" : shapeOf(word[idx]);
		if (k === -1) shape += "|";
	}
	f.push(`s=${shape}`, `s4=${shape.slice(2, 7)}`);
	f.push(
		`from-start=${Math.min(i, 5)}`,
		`from-end=${Math.min(word.length - i, 5)}`,
	);
	const left = word.slice(0, i);
	const right = word.slice(i);
	f.push(
		`left-vowel=${[...left].some(isVowel)}`,
		`right-vowel=${[...right].some(isVowel)}`,
	);
	f.push(`end=${right.length <= 4 ? right : `*${right.slice(-3)}`}`);
	f.push(`start=${left.length <= 4 ? left : `${left.slice(0, 3)}*`}`);
	if (ruleCuts) {
		const r = ruleCuts.has(i) ? "cut" : "no";
		// Every feature again, tied to what the rules did.
		return [...f, ...f.map((feature) => `rule-${r}&${feature}`)];
	}
	return f;
}

export interface Model {
	bits: number;
	weights: Float32Array;
}

function hash(text: string, bits: number) {
	let h = 2166136261;
	for (let k = 0; k < text.length; k++)
		h = Math.imul(h ^ text.charCodeAt(k), 16777619) >>> 0;
	return h & ((1 << bits) - 1);
}

const sigmoid = (z: number) => 1 / (1 + Math.exp(-z));

function score(model: Model, features: string[]) {
	let z = 0;
	for (const f of features) z += model.weights[hash(f, model.bits)];
	return z;
}

const ruleCutSet = (ruleSplit: string | undefined) =>
	ruleSplit === undefined ? undefined : new Set(cutsOf(ruleSplit));

/**
 * Probability of a cut at each gap 1..length-1 (index 0 is gap 1). Pass the
 * rules' split when the model was trained with it.
 */
export function cutProbabilities(
	model: Model,
	word: string,
	ruleSplit?: string,
) {
	const lower = word.toLowerCase();
	const rule = ruleCutSet(ruleSplit);
	const probs: number[] = [];
	for (let i = 1; i < lower.length; i++)
		probs.push(sigmoid(score(model, gapFeatures(lower, i, rule))));
	return probs;
}

/**
 * Cuts where the probability is over `threshold`, then drops the weakest cut
 * while any piece has no vowel (a piece with no vowel isn't a sung syllable).
 */
export function predictCuts(
	model: Model,
	word: string,
	threshold = 0.5,
	ruleSplit?: string,
) {
	const probs = cutProbabilities(model, word, ruleSplit);
	const lower = word.toLowerCase();
	let cuts = probs.flatMap((p, k) => (p > threshold ? [k + 1] : []));
	const vowelless = () =>
		splitAt(lower, cuts)
			.split("/")
			.some((piece) => ![...piece].some(isVowel));
	while (cuts.length && vowelless()) {
		const weakest = cuts.reduce((a, b) =>
			probs[a - 1] <= probs[b - 1] ? a : b,
		);
		cuts = cuts.filter((c) => c !== weakest);
	}
	return { cuts, probs };
}

/** One training word: the gaps with a target probability (1 cut, 0 no cut). */
export interface Example {
	word: string;
	targets: number[];
	weight?: number;
	/** The rules' split, for a model that learns when to overrule them. */
	ruleSplit?: string;
}

export function trainModel(
	examples: Example[],
	{
		bits = 20,
		epochs = 6,
		rate = 0.2,
		l2 = 1e-7,
		start,
	}: {
		bits?: number;
		epochs?: number;
		rate?: number;
		l2?: number;
		start?: Model;
	} = {},
): Model {
	const model: Model = start
		? { bits: start.bits, weights: Float32Array.from(start.weights) }
		: { bits, weights: new Float32Array(1 << bits) };
	const order = examples.map((_, k) => k);
	let seed = 1;
	const random = () => {
		seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0;
		return seed / 2 ** 32;
	};
	for (let epoch = 0; epoch < epochs; epoch++) {
		for (let k = order.length - 1; k > 0; k--) {
			const j = Math.floor(random() * (k + 1));
			[order[k], order[j]] = [order[j], order[k]];
		}
		const step = rate / (1 + epoch);
		for (const index of order) {
			const { word, targets, weight = 1, ruleSplit } = examples[index];
			const lower = word.toLowerCase();
			const rule = ruleCutSet(ruleSplit);
			for (let i = 1; i < lower.length; i++) {
				const target = targets[i - 1];
				if (target === undefined || Number.isNaN(target)) continue;
				const features = gapFeatures(lower, i, rule);
				const slots = features.map((f) => hash(f, model.bits));
				let z = 0;
				for (const s of slots) z += model.weights[s];
				const gradient = (sigmoid(z) - target) * weight;
				for (const s of slots)
					model.weights[s] -= step * (gradient + l2 * model.weights[s]);
			}
		}
	}
	return model;
}
