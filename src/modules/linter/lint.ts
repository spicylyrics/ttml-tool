import {
	collectFollowingBackgroundLines,
	hasExportableLineContent,
	shouldExportAsLineSynced,
} from "$/modules/project/logic/ttml-writer";
import type { LyricLine, TTMLLyric } from "$/types/ttml";
import type { LyricTextNormalizationOptions } from "$/utils/apostrophe-normalization";
import { produceTTMLText } from "../project/logic/ttml-export";
import { findGuideSpellings, GUIDE_SPELLING_RULE } from "./guide-spelling";
import { type Finding, lintTtml, type Severity } from "./vendor";
import type { Line, Syllable } from "./vendor/model";

export type { Severity };

export interface LintProblem {
	/** Unique within one result, stable while the finding stays the same. */
	key: string;
	severity: Severity;
	rule: string;
	/** The bot's own English message, kept identical on purpose. */
	message: string;
	/** Tool-only rules carry a translatable message instead. */
	i18n?: { key: string; params: Record<string, string> };
	/** The editor line the finding is about: the lead line, or a background line. */
	lineId?: string;
	wordIds: string[];
	/** Milliseconds, when the finding points at a moment. */
	timeMs?: number;
	/** The bot shows these first, in bold. */
	loud: boolean;
}

export interface LyricLintResult {
	/** False when Spicy Lyrics wouldn't load the export. */
	loads: boolean;
	problems: LintProblem[];
	counts: Record<Severity, number>;
	omitted: number;
	/** The linter itself threw; nothing is known about the file. */
	failed: boolean;
}

export interface LintOptions {
	normalization?: LyricTextNormalizationOptions;
	allowConsecutiveBackgroundLines?: boolean;
}

/** One `<p>` the writer emits, with the editor lines it was built from. */
interface ParagraphSource {
	lead: LyricLine | null;
	backgrounds: LyricLine[];
}

/** Mirrors the writer's walk so `itunes:key="L{n}"` resolves to editor lines. */
function paragraphSources(
	lines: LyricLine[],
	allowConsecutive: boolean,
): Map<string, ParagraphSource> {
	const exportable = lines.filter(hasExportableLineContent);
	const out = new Map<string, ParagraphSource>();
	let n = 0;
	for (let i = 0; i < exportable.length; i++) {
		const line = exportable[i];
		const standalone = allowConsecutive && line.isBG;
		const following = collectFollowingBackgroundLines(
			exportable,
			i,
			allowConsecutive,
		);
		i += following.length;
		out.set(`L${++n}`, {
			lead: standalone ? null : line,
			backgrounds: standalone ? [line, ...following] : following,
		});
	}
	return out;
}

/** The words the writer turns into spans, in the order the bot reads them. */
function spanWords(line: LyricLine) {
	if (shouldExportAsLineSynced(line)) return [];
	return line.words.filter((word) => word.word.trim().length > 0);
}

function resolveWords(
	syllables: Syllable[],
	marks: Syllable[] | undefined,
	source: LyricLine | undefined,
): string[] {
	if (!marks?.length || !source) return [];
	const words = spanWords(source);
	if (words.length !== syllables.length) return [];
	return marks.flatMap((mark) => {
		const id = words[syllables.indexOf(mark)]?.id;
		return id ? [id] : [];
	});
}

function toProblem(
	finding: Finding,
	index: number,
	sources: Map<string, ParagraphSource>,
): LintProblem {
	const line: Line | undefined = finding.line;
	const source = line?.key ? sources.get(line.key) : undefined;
	let editorLine: LyricLine | undefined;
	let syllables: Syllable[] = [];
	if (line && source) {
		const bgIndex = finding.background
			? line.backgrounds.indexOf(finding.background)
			: -1;
		if (bgIndex !== -1) {
			editorLine = source.backgrounds[bgIndex];
			syllables = finding.background?.syllables ?? [];
		} else {
			editorLine = source.lead ?? source.backgrounds[0];
			syllables = source.lead ? line.lead : [];
		}
	}
	const time = finding.time ?? line?.begin;
	return {
		key: `${index}:${finding.rule}:${line?.key ?? ""}`,
		severity: finding.severity,
		rule: finding.rule,
		message: finding.message,
		lineId: editorLine?.id,
		wordIds: resolveWords(syllables, finding.marks, editorLine),
		timeMs: time == null ? undefined : Math.round(time * 1000),
		loud: finding.loud ?? false,
	};
}

/**
 * Background-line structure the bot doesn't accept yet. Hidden while the
 * user allows consecutive background lines, since that setting is what
 * produces them. Once Spicy Lyrics makes it official, they go for good.
 */
export const BG_STRUCTURE_RULES = new Set([
	"starts-with-background",
	"background-only-line",
	"stacked-backgrounds",
]);

/** Where the tool grades differently from the bot (TX24, 2026-10-27). */
const TOOL_SEVERITY: Record<string, Severity> = {
	// Forbidden by the Uploading and TTML Rules, so they block approval.
	"stretched-spelling": "error",
	"bracketed-note": "error",
	"section-label": "error",
	"repeat-shorthand": "error",
	"phrase-hyphen": "error",
	// A plain warning in the tool, not the bot's moderation banner.
	"copied-text": "warning",
};

function applyToolPolicy(
	problems: LintProblem[],
	allowConsecutive: boolean,
): LintProblem[] {
	return problems
		.filter((p) => !(allowConsecutive && BG_STRUCTURE_RULES.has(p.rule)))
		.map((p) => {
			const severity = TOOL_SEVERITY[p.rule];
			if (!severity) return p;
			return { ...p, severity, loud: false };
		});
}

function guideSpellingProblems(lines: LyricLine[]): LintProblem[] {
	return findGuideSpellings(lines).map((hit, index) => ({
		key: `${GUIDE_SPELLING_RULE}:${index}:${hit.lineId}`,
		severity: "hint",
		rule: GUIDE_SPELLING_RULE,
		message: `"${hit.found}": the standard spelling is "${hit.preferred}".`,
		i18n: {
			key: "linter.guideSpelling",
			params: {
				found: hit.found,
				preferred: hit.preferred,
				context: hit.context ?? "none",
			},
		},
		lineId: hit.lineId,
		wordIds: hit.wordIds,
		timeMs: hit.timeMs,
		loud: false,
	}));
}

function countBySeverity(problems: LintProblem[]): Record<Severity, number> {
	const counts: Record<Severity, number> = { error: 0, warning: 0, hint: 0 };
	for (const p of problems) counts[p.severity]++;
	return counts;
}

/** The bot's findings for the export, mapped to editor ids, no tool policy. */
export function lintLyricAsBot(
	lyric: TTMLLyric,
	options: LintOptions = {},
): LyricLintResult {
	const allowConsecutive = options.allowConsecutiveBackgroundLines ?? false;
	const text = produceTTMLText(lyric, options.normalization, {
		allowConsecutiveBackgroundLines: allowConsecutive,
	});
	const result = lintTtml(text);
	const sources = paragraphSources(lyric.lyricLines, allowConsecutive);
	return {
		loads: result.loads !== false,
		problems: result.findings.map((finding, index) =>
			toProblem(finding, index, sources),
		),
		counts: result.counts,
		omitted: result.omitted,
		failed: false,
	};
}

/**
 * Lints exactly what an export would write: the lyric goes through the
 * writer, and the vendored Spicy Lyrics bot linter reads the result. The
 * tool's own policy and extra rules are applied on top.
 */
export function lintLyric(
	lyric: TTMLLyric,
	options: LintOptions = {},
): LyricLintResult {
	const allowConsecutive = options.allowConsecutiveBackgroundLines ?? false;
	try {
		const bot = lintLyricAsBot(lyric, options);
		const problems = applyToolPolicy(bot.problems, allowConsecutive);
		if (bot.loads) problems.push(...guideSpellingProblems(lyric.lyricLines));
		return { ...bot, problems, counts: countBySeverity(problems) };
	} catch {
		return {
			loads: true,
			problems: [],
			counts: { error: 0, warning: 0, hint: 0 },
			omitted: 0,
			failed: true,
		};
	}
}
