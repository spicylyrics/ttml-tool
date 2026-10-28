/**
 * Over-splitting cases for Auto Segment on import (survey item R58).
 *
 * These are reasoned guesses, not examples from users. Replace or extend them
 * with real reports before tuning the engine.
 *
 * - `overSplit`: words the default engine (prosodic) splits today, though
 *   they are sung as one syllable or are contractions. Their tests are
 *   expected to fail until the engine is fixed; when one starts passing,
 *   move it to `keepWhole`.
 * - `keepWhole`: one-syllable words the engine leaves whole today. They guard
 *   against a tuning change that starts splitting them.
 */
export interface OverSplitFixture {
	word: string;
	/** What the split should be. */
	expected: string[];
	/** What the engine produces today, for reference. */
	current?: string[];
	why: string;
}

export const overSplit: OverSplitFixture[] = [
	{
		word: "hour",
		expected: ["hour"],
		current: ["ho", "ur"],
		why: "Sung as one syllable; the split also breaks the vowel pair.",
	},
	{
		word: "tired",
		expected: ["tired"],
		current: ["ti", "red"],
		why: "One syllable in most songs; the -ed ending isn't a syllable here.",
	},
	{
		word: "y'all",
		expected: ["y'all"],
		current: ["y", "'all"],
		why: "A contraction; contractions stay whole.",
	},
	{
		word: "prism",
		expected: ["pris", "m"],
		current: ["pr", "ism"],
		why: "Two beats, but the split leaves a part with no vowel sound at the front.",
	},
];

export const keepWhole: OverSplitFixture[] = [
	{ word: "fire", expected: ["fire"], why: "One syllable." },
	{ word: "our", expected: ["our"], why: "One syllable." },
	{ word: "world", expected: ["world"], why: "One syllable." },
	{ word: "loved", expected: ["loved"], why: "Silent -ed." },
	{ word: "queen", expected: ["queen"], why: "One syllable." },
	{ word: "real", expected: ["real"], why: "One syllable." },
	{ word: "yeah", expected: ["yeah"], why: "Interjection." },
	{ word: "ooh", expected: ["ooh"], why: "Interjection." },
	{ word: "mmm", expected: ["mmm"], why: "Interjection." },
];
