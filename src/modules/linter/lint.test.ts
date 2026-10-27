// @vitest-environment jsdom
import { describe, expect, it, vi } from "vitest";

vi.mock("$/utils/logging", () => ({ error: vi.fn(), log: vi.fn() }));

import { produceTTMLText } from "$/modules/project/logic/ttml-export";
import { parseLyric } from "$/modules/project/logic/ttml-parser";
import {
	type LyricLine,
	newLyricLine,
	newLyricWord,
	type TTMLLyric,
} from "$/types/ttml";
import { STRESS_FIXTURES } from "./__fixtures__/stress";
import { lintLyric, lintLyricAsBot } from "./lint";
import { lintTtml } from "./vendor";

type Tallied = { rule: string; severity: string };
const tally = (items: Tallied[]) => {
	const out: Record<string, number> = {};
	for (const { rule, severity } of items) {
		const key = `${severity}:${rule}`;
		out[key] = (out[key] ?? 0) + 1;
	}
	return out;
};
const sameFindings = (items: (Tallied & { message: string })[]) =>
	items.map(({ rule, severity, message }) => ({ rule, severity, message }));

const line = (
	words: [string, number, number][],
	extra: Partial<LyricLine> = {},
): LyricLine => ({
	...newLyricLine(),
	words: words.map(([word, startTime, endTime]) => ({
		...newLyricWord(),
		word,
		startTime,
		endTime,
	})),
	startTime: words[0]?.[1] ?? 0,
	endTime: words[words.length - 1]?.[2] ?? 0,
	...extra,
});
const lyricOf = (lyricLines: LyricLine[]): TTMLLyric => ({
	metadata: [{ key: "songwriter", value: ["Writer One"] }],
	lyricLines,
});

describe("vendored bot linter on the stress fixtures", () => {
	// Recorded from the bot at 03e16e2; any change means the port drifted.
	const expected = {
		"big-realistic": {
			loads: true,
			counts: { error: 0, warning: 2755, hint: 0 },
			omitted: 1255,
			rules: { "warning:songwriters-missing": 1, "warning:empty-line": 1499 },
		},
		"deep-nesting": {
			loads: false,
			counts: { error: 1, warning: 0, hint: 0 },
			omitted: 0,
			rules: { "error:xml-malformed": 1 },
		},
		"huge-word": {
			loads: true,
			counts: { error: 0, warning: 1, hint: 2 },
			omitted: 0,
			rules: {
				"warning:songwriters-missing": 1,
				"hint:long-line": 1,
				"hint:lowercase-start": 1,
			},
		},
		"many-tiny-spans": {
			loads: true,
			counts: { error: 512, warning: 512, hint: 256 },
			omitted: 0,
			rules: {
				"warning:songwriters-missing": 1,
				"error:ends-before-start": 512,
				"warning:syllables-out-of-order": 256,
				"hint:lowercase-start": 256,
				"warning:duplicate-line": 255,
			},
		},
	};
	for (const [name, build] of Object.entries(STRESS_FIXTURES)) {
		it(`${name} gives the recorded findings, fast`, () => {
			const raw = build();
			const started = performance.now();
			const result = lintTtml(raw);
			const elapsed = performance.now() - started;
			console.info(`[lint perf] ${name}: ${elapsed.toFixed(0)} ms`);
			expect({
				loads: result.loads,
				counts: result.counts,
				omitted: result.omitted,
				rules: tally(result.findings),
			}).toEqual(expected[name as keyof typeof expected]);
			// Generous for CI; locally these run in 10-70 ms.
			expect(elapsed).toBeLessThan(3000);
		});
	}
});

describe("live lint cost on a long song", () => {
	it("serializes and lints a 200-line song with background vocals", () => {
		const lines: LyricLine[] = [];
		for (let i = 0; i < 200; i++) {
			const at = i * 3000;
			const words = "Every word here is sung on time tonight"
				.split(" ")
				.map((word, w, all): [string, number, number] => [
					w < all.length - 1 ? `${word} ` : word,
					at + w * 300,
					at + w * 300 + 300,
				]);
			lines.push(line(words));
			if (i % 4 === 0)
				lines.push(
					line(
						[
							["oh ", at + 600, at + 900],
							["yeah", at + 900, at + 1200],
						],
						{ isBG: true },
					),
				);
		}
		const lyric = lyricOf(lines);
		lintLyric(lyric);
		const started = performance.now();
		const result = lintLyric(lyric);
		const elapsed = performance.now() - started;
		console.info(
			`[lint perf] 250-line song, end to end: ${elapsed.toFixed(0)} ms`,
		);
		expect(result.failed).toBe(false);
		expect(elapsed).toBeLessThan(3000);
	});
});

describe("adapter reports exactly what the bot reports for the export", () => {
	const cases: [string, TTMLLyric][] = [
		...(["huge-word", "many-tiny-spans", "big-realistic"] as const).map(
			(name): [string, TTMLLyric] => [
				name,
				parseLyric(STRESS_FIXTURES[name](12000)),
			],
		),
		[
			"hand-built",
			lyricOf([
				line([
					["Hello ", 1000, 1400],
					["un", 1400, 1500],
					["-der ", 1500, 1600],
					["it", 1600, 1700],
				]),
				line([
					["oh ", 1500, 1800],
					["yeah", 1700, 2000],
				]),
				line([["[Chorus]", 3000, 3500]]),
			]),
		],
	];
	for (const [name, lyric] of cases) {
		it(name, () => {
			const ours = lintLyricAsBot(lyric);
			const bot = lintTtml(produceTTMLText(lyric));
			expect(sameFindings(ours.problems)).toEqual(sameFindings(bot.findings));
			expect(ours.counts).toEqual(bot.counts);
		});
	}
});

describe("imported files: bot on the raw file vs the tool after import", () => {
	const compare = (name: keyof typeof STRESS_FIXTURES) => {
		const raw = STRESS_FIXTURES[name](12000);
		return {
			bot: tally(lintTtml(raw).findings),
			tool: tally(lintLyricAsBot(parseLyric(raw)).problems),
		};
	};
	it("matches where the importer keeps the file as written", () => {
		for (const name of ["huge-word", "many-tiny-spans"] as const) {
			const raw = STRESS_FIXTURES[name](12000);
			expect(
				sameFindings(lintLyricAsBot(parseLyric(raw)).problems),
				name,
			).toEqual(sameFindings(lintTtml(raw).findings));
		}
	});
	it("big-realistic: the importer rescues text written outside spans", () => {
		// The bot reads untimed <p> text in a word-timed file as empty lines;
		// the importer keeps it as line-synced text, so the export is clean.
		expect(compare("big-realistic")).toEqual({
			bot: { "warning:songwriters-missing": 1, "warning:empty-line": 125 },
			tool: { "warning:songwriters-missing": 1, "hint:case-lower": 1 },
		});
	});
	it("deep-nesting: the importer reads nesting the bot's parser rejects", () => {
		// What remains is a romanization-only line with no lyric, which the
		// bot reports on the tool's export.
		expect(compare("deep-nesting")).toEqual({
			bot: { "error:xml-malformed": 1 },
			tool: {
				"warning:timing-ignored": 1,
				"warning:songwriters-missing": 1,
				"warning:empty-line": 1,
			},
		});
	});
	it("a full-size import exports past the API's size cap", () => {
		// The writer adds keys, agents and namespaces, so a file at the cap
		// grows past it; the bot then reads nothing else, and neither do we.
		const result = lintLyricAsBot(
			parseLyric(STRESS_FIXTURES["many-tiny-spans"]()),
		);
		expect(result.loads).toBe(false);
		expect(tally(result.problems)).toEqual({ "error:file-too-large": 1 });
	});
});

describe("findings point at editor lines and words", () => {
	it("maps lead and background findings past skipped empty lines", () => {
		const lead = line([
			["Hello ", 1000, 1400],
			["un", 1400, 1500],
			["-der ", 1500, 1600],
			["it", 1600, 1700],
		]);
		const bg = line(
			[
				["oh ", 1500, 1800],
				["yeah", 1700, 2000],
			],
			{ isBG: true },
		);
		const empty = line([]);
		const label = line([["[Chorus]", 3000, 3500]]);
		const result = lintLyricAsBot(lyricOf([lead, bg, empty, label]));

		const hyphen = result.problems.find((p) => p.rule === "hyphen-wrong-side");
		expect(hyphen?.lineId).toBe(lead.id);
		expect(hyphen?.wordIds).toEqual([lead.words[1].id, lead.words[2].id]);
		expect(hyphen?.timeMs).toBe(1500);

		const overlap = result.problems.find((p) => p.rule === "syllable-overlap");
		expect(overlap?.lineId).toBe(bg.id);
		expect(overlap?.wordIds).toEqual([bg.words[0].id, bg.words[1].id]);

		const section = result.problems.find((p) => p.rule === "section-label");
		expect(section?.lineId).toBe(label.id);
	});
});

describe("tool policy on top of the bot", () => {
	it("hides background-structure rules only while consecutive bg is allowed", () => {
		const lyric = lyricOf([
			line([["Ooh", 500, 900]], { isBG: true }),
			line([
				["Hello ", 1000, 1400],
				["there", 1400, 1800],
			]),
		]);
		const options = { allowConsecutiveBackgroundLines: true };
		const rules = (problems: { rule: string }[]) => problems.map((p) => p.rule);
		expect(rules(lintLyricAsBot(lyric, options).problems)).toContain(
			"starts-with-background",
		);
		expect(rules(lintLyric(lyric, options).problems)).not.toContain(
			"starts-with-background",
		);
	});
	it("grades guide-forbidden findings as errors and recounts", () => {
		const result = lintLyric(
			lyricOf([
				line([
					["Hello ", 1000, 1400],
					["there", 1400, 1800],
				]),
				line([["[Chorus]", 3000, 3500]]),
			]),
		);
		const section = result.problems.find((p) => p.rule === "section-label");
		expect(section?.severity).toBe("error");
		expect(result.counts.error).toBe(
			result.problems.filter((p) => p.severity === "error").length,
		);
	});
	it("softens copied-text to a plain warning", () => {
		// Cyrillic "е" inside Latin words, three times.
		const lyric = lyricOf(
			[0, 1, 2].map((i) =>
				line([
					["Hеllo ", 1000 + i * 1000, 1400 + i * 1000],
					["there", 1400 + i * 1000, 1800 + i * 1000],
				]),
			),
		);
		expect(
			lintLyricAsBot(lyric).problems.find((p) => p.rule === "copied-text"),
		).toMatchObject({ severity: "error", loud: true });
		expect(
			lintLyric(lyric).problems.find((p) => p.rule === "copied-text"),
		).toMatchObject({ severity: "warning", loud: false });
	});
	it("adds guide spellings the bot's list misses, on English songs", () => {
		const lyric = lyricOf([
			line([
				["I ", 1000, 1200],
				["will ", 1200, 1400],
				["wait ", 1400, 1600],
				["aye ", 1600, 1800],
				["the ", 1800, 2000],
				["end", 2000, 2400],
			]),
			line([
				["You ", 3000, 3200],
				["and ", 3200, 3400],
				["me ", 3400, 3600],
				["in ", 3600, 3800],
				["the ", 3800, 4000],
				["night", 4000, 4400],
			]),
		]);
		const hit = lintLyric(lyric).problems.find(
			(p) => p.rule === "guide-spelling",
		);
		expect(hit).toMatchObject({
			severity: "hint",
			lineId: lyric.lyricLines[0].id,
			wordIds: [lyric.lyricLines[0].words[3].id],
			i18n: {
				key: "linter.guideSpelling",
				params: { found: "aye", preferred: "ayy", context: "interjection" },
			},
		});
	});
	it("leaves 'till' and plain 'perk' alone, like the ttml-review checker", () => {
		const lyric = lyricOf([
			line([
				["I ", 1000, 1200],
				["will ", 1200, 1400],
				["wait ", 1400, 1600],
				["till ", 1600, 1800],
				["the ", 1800, 2000],
				["perk", 2000, 2400],
			]),
			line([
				["You ", 3000, 3200],
				["and ", 3200, 3400],
				["me ", 3400, 3600],
				["in ", 3600, 3800],
				["the ", 3800, 4000],
				["night", 4000, 4400],
			]),
		]);
		expect(
			lintLyric(lyric).problems.filter((p) => p.rule === "guide-spelling"),
		).toEqual([]);
	});
	it("makes overlaps errors on lead lines, not on background vocals", () => {
		const lead = line([
			["Hello ", 1000, 1600],
			["there", 1500, 2000],
		]);
		const bg = line(
			[
				["oh ", 1500, 1800],
				["yeah", 1700, 2000],
			],
			{ isBG: true },
		);
		const overlaps = lintLyric(lyricOf([lead, bg])).problems.filter(
			(p) => p.rule === "syllable-overlap",
		);
		expect(overlaps.find((p) => p.lineId === lead.id)?.severity).toBe("error");
		expect(overlaps.find((p) => p.lineId === bg.id)?.severity).toBe("hint");
	});
	it("blocks on missing songwriters, ellipses and zero-length words", () => {
		const result = lintLyric({
			metadata: [],
			lyricLines: [
				line([
					["Wait... ", 1000, 1000],
					["for ", 1000, 1400],
					["me", 1400, 1800],
				]),
			],
		});
		const severity = (rule: string) =>
			result.problems.find((p) => p.rule === rule)?.severity;
		expect(severity("songwriters-missing")).toBe("error");
		expect(severity("ellipsis")).toBe("error");
		expect(severity("zero-length")).toBe("error");
	});
	it("adds the ttml-review checker's gap, number and symbol hints", () => {
		const lyric = lyricOf([
			line([
				["I ", 1000, 1200],
				["got ", 1210, 1400],
				["3 ", 1400, 1600],
				["of ", 1600, 1800],
				["them ", 1800, 2000],
				["now ♪", 2000, 2400],
			]),
			line([
				["You ", 3000, 3200],
				["and ", 3200, 3400],
				["me ", 3400, 3600],
				["in ", 3600, 3800],
				["the ", 3800, 4000],
				["night", 4000, 4400],
			]),
		]);
		const [first] = lyric.lyricLines;
		const problems = lintLyric(lyric).problems;
		expect(problems.find((p) => p.rule === "word-gap")).toMatchObject({
			severity: "hint",
			lineId: first.id,
			wordIds: [first.words[0].id, first.words[1].id],
			i18n: { key: "linter.wordGap", params: { gap: "10", word: "got" } },
		});
		expect(problems.find((p) => p.rule === "spoken-number")).toMatchObject({
			severity: "hint",
			wordIds: [first.words[2].id],
			i18n: { params: { number: "3" } },
		});
		expect(problems.find((p) => p.rule === "decorative-symbol")).toMatchObject({
			severity: "hint",
			i18n: { params: { symbol: "♪" } },
		});
	});
	it("has nothing to say about a project with no lyrics yet", () => {
		const result = lintLyric(lyricOf([line([])]));
		expect(result).toMatchObject({ loads: true, failed: false, problems: [] });
		expect(lintLyricAsBot(lyricOf([line([])])).loads).toBe(false);
	});
	it("reports a failed run instead of throwing", () => {
		const broken = { metadata: [], lyricLines: null } as unknown as TTMLLyric;
		expect(lintLyric(broken).failed).toBe(true);
	});
});
