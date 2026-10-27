// Builds the linter stress fixtures in memory: deliberately ugly TTMLs that
// stay under the bot's size cap so they reach the parse and every check.
// `budget` sets the size; the full fixtures use the cap minus a margin.

export const STRESS_CAP = 262144;

const head =
	`<?xml version="1.0" encoding="UTF-8"?>\n` +
	`<tt xmlns="http://www.w3.org/ns/ttml" xmlns:ttm="http://www.w3.org/ns/ttml#metadata" ` +
	`xmlns:itunes="http://music.apple.com/lyric-ttml-internal" itunes:timing="Word" xml:lang="en">\n` +
	`<body><div>\n`;
const tail = `\n</div></body></tt>\n`;
const wrap = (inner: string) => head + inner + tail;

/** One x-roman span wrapping thousands of nested spans. */
export function deepNesting(budget = STRESS_CAP - 400): string {
	const levels = Math.floor((budget - 200) / 13);
	return wrap(
		`<p begin="00:00.000" end="00:05.000"><span ttm:role="x-roman">` +
			"<span>".repeat(levels) +
			"x" +
			"</span>".repeat(levels) +
			`</span></p>`,
	);
}

/** Thousands of word-timed spans, timing pairs reused everywhere. */
export function manyTinySpans(budget = STRESS_CAP - 400): string {
	const lines: string[] = [];
	let used = 0;
	while (used < budget - 400) {
		const spans: string[] = [];
		for (let i = 0; i < 20; i++)
			spans.push(
				`<span begin="00:0${i % 10}.000" end="00:0${(i + 1) % 10}.000">la</span>`,
			);
		const p = `<p begin="00:00.000" end="00:20.000">${spans.join("")}</p>`;
		lines.push(p);
		used += p.length + 1;
	}
	return wrap(lines.join("\n"));
}

/** One line whose lead is a single enormous hyphenated token. */
export function hugeWord(budget = STRESS_CAP - 400): string {
	const word = `${"a-".repeat(Math.floor((budget - 300) / 2))}a`;
	return wrap(
		`<p begin="00:00.000" end="00:05.000"><span begin="00:00.000" end="00:05.000">${word}</span></p>`,
	);
}

/** Many identical lines of untimed text in a word-timed file. */
export function bigRealistic(budget = STRESS_CAP - 400): string {
	const lines: string[] = [];
	let used = 0;
	const line = `<p begin="00:00.000" end="00:03.000">the quick brown fox jumps over the lazy dog and sings</p>`;
	while (used < budget - 200) {
		lines.push(line);
		used += line.length + 1;
	}
	return wrap(lines.join("\n"));
}

export const STRESS_FIXTURES = {
	"big-realistic": bigRealistic,
	"deep-nesting": deepNesting,
	"huge-word": hugeWord,
	"many-tiny-spans": manyTinySpans,
} as const;
