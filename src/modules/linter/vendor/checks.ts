import {
  backgroundText,
  formatTime,
  leadText,
  shownText,
  wordsOf,
  type Background,
  type Line,
  type Syllable,
  type TtmlDocument,
} from "./model";

/**
 * error: Spicy Lyrics won't load the file, or shows it visibly wrong.
 * warning: breaks a TTML rule, or is almost certainly a mistake.
 * hint: style and spelling conventions, and heuristics that need a human look.
 */
export type Severity = "error" | "warning" | "hint";

export interface Finding {
  severity: Severity;
  rule: string;
  message: string;
  line?: Line;
  /** Which part of the line the finding is about; undefined means the lead. */
  background?: Background;
  /** Syllables to underline when the line is quoted. */
  marks?: Syllable[];
  time?: number | null;
  /** Shown in bold ahead of everything else. */
  loud?: boolean;
}

// Timestamps are written to the millisecond; anything closer is the same instant.
const SAME_INSTANT = 0.001;
// Crossings this small come from rounding in timing tools and can't be heard.
const INAUDIBLE_OVERLAP = 0.0055;
// Past this, two syllables crossing reads as a deliberately held note.
const HELD_NOTE_OVERLAP = 0.08;
// A pause this long inside one word is audible as a break.
const AUDIBLE_WORD_GAP = 0.3;
const LONG_SYLLABLE = 8;

class Findings {
  readonly items: Finding[] = [];
  add(f: Finding) {
    this.items.push(f);
  }
}

const quoteOf = (s: Syllable) => `"${clip(shownText(s) || s.text, 40)}"`;
const ms = (seconds: number) => `${Math.round(seconds * 1000)} ms`;
const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

// ---------------------------------------------------------------- characters

const hex = (ch: string) => `U+${ch.codePointAt(0)!.toString(16).toUpperCase().padStart(4, "0")}`;

// Format characters (Unicode Cf) never belong in lyrics, with two exceptions:
// joiners are part of the spelling in several scripts and in emoji sequences.
const FORMAT_CHAR = /\p{Cf}/u;
const JOINERS_NEEDED = /[\u200C\u200D]/;
const SCRIPT_USES_JOINERS = /[\p{Script=Arabic}\p{Script=Devanagari}\p{Script=Bengali}\p{Script=Gurmukhi}\p{Script=Gujarati}\p{Script=Oriya}\p{Script=Tamil}\p{Script=Telugu}\p{Script=Kannada}\p{Script=Malayalam}\p{Script=Sinhala}\p{Script=Khmer}\p{Extended_Pictographic}]/u;
const DIRECTION_CHAR = /[\u061C\u200E\u200F\u202A-\u202E\u2066-\u2069]/;
// Lines that mix right-to-left script with other text can need direction marks
// to draw in the right order, so there they're only pointed out.
const RTL_SCRIPT = /[\p{Script=Hebrew}\p{Script=Arabic}\p{Script=Syriac}\p{Script=Thaana}\p{Script=Nko}]/u;
const SPACE_CHAR = /[\p{Zs}\t\n\r\u2028\u2029]/u;
const CONTROL_CHAR = /\p{Cc}/u;
const TYPOGRAPHIC_QUOTE = /[\u2018\u2019\u201A\u201B\u201C\u201D\u201E\u2032\u2033\u02BC\u00B4\uFF07\uFF02`]/;
const LATIN_LETTER = /\p{Script=Latin}/u;
const LOOKALIKE_LETTER = /[\p{Script=Cyrillic}\p{Script=Greek}]/u;
// Letters and gaps that turn up together in lyrics copied out of an app rather than typed.
const COPIED_LETTERS = /[\u0430\u0435\u043E\u0440]/;
const COPIED_GAP = / \u200B/;

function describeSpace(ch: string): string {
  if (ch === "\t") return "a tab";
  if (ch === "\n" || ch === "\r" || ch === "\u2028" || ch === "\u2029") return "a line break";
  if (ch === "\u00A0" || ch === "\u202F") return `a no-break space (${hex(ch)})`;
  return `an unusual space character (${hex(ch)})`;
}

function checkCharacters(out: Findings, doc: TtmlDocument) {
  let copiedHits = 0;
  for (const line of doc.lines) {
    const pieces: { s: Syllable | null; text: string; bg?: Background }[] = [];
    for (const s of line.lead) pieces.push({ s, text: s.text });
    for (const bg of line.backgrounds) {
      for (const s of bg.syllables) pieces.push({ s, text: s.text, bg });
      // The whitespace around untimed text is the file's indentation, not part of the lyric.
      if (bg.directText.trim()) pieces.push({ s: null, text: bg.directText.trim(), bg });
    }
    if (line.directText.trim()) pieces.push({ s: null, text: line.directText.trim() });
    const rtl = pieces.some((p) => RTL_SCRIPT.test(p.text));

    // One finding per kind of problem per line; the first place it shows is marked.
    const reported = new Set<string>();
    const report = (kind: string, f: Omit<Finding, "line">) => {
      if (reported.has(kind)) return;
      reported.add(kind);
      out.add({ ...f, line });
    };

    for (const { s, text, bg } of pieces) {
      const where = { marks: s ? [s] : undefined, background: bg, time: s?.begin ?? line.begin };
      if (COPIED_GAP.test(text)) copiedHits++;
      const joinersOk = SCRIPT_USES_JOINERS.test(text);
      // Spaces at the edges of a span are how words are separated; only the
      // character itself matters there, not the plain space.
      for (const ch of text) {
        if (ch === " ") continue;
        if (DIRECTION_CHAR.test(ch)) {
          if (rtl) report("direction", { severity: "hint", rule: "direction-character", message: `Text-direction mark (${hex(ch)}) in a right-to-left line. Keep it only if the line draws in the wrong order without it.`, ...where });
          else report("direction", { severity: "error", rule: "direction-character", message: `Hidden text-direction mark (${hex(ch)}) that can reorder how the line is drawn. Delete it.`, ...where });
        } else if (FORMAT_CHAR.test(ch)) {
          if (JOINERS_NEEDED.test(ch) && joinersOk) continue;
          report(`format${ch}`, { severity: "warning", rule: "invisible-character", message: `Invisible character ${hex(ch)} hidden in the text. Delete it; it breaks search and copy-paste.`, ...where });
        } else if (SPACE_CHAR.test(ch)) {
          if (text.trim()) report(`space${ch}`, { severity: "warning", rule: "odd-space", message: `Uses ${describeSpace(ch)} where a normal space belongs.`, ...where });
        } else if (CONTROL_CHAR.test(ch)) {
          report("control", { severity: "error", rule: "control-character", message: `Control character ${hex(ch)} in the text. Delete it.`, ...where });
        } else if (TYPOGRAPHIC_QUOTE.test(ch)) {
          report("quote", { severity: "hint", rule: "curly-quote", message: `"${ch}" should be a plain ${/[\u201C\u201D\u201E\u2033\uFF02]/.test(ch) ? `"` : "'"}.`, ...where });
        }
      }
      for (const word of text.split(/[\s\p{P}\p{S}]+/u)) {
        if (!word || !LATIN_LETTER.test(word) || !LOOKALIKE_LETTER.test(word)) continue;
        const odd = [...word].find((c) => LOOKALIKE_LETTER.test(c))!;
        if (COPIED_LETTERS.test(odd)) copiedHits++;
        report(`lookalike${word}`, {
          severity: "error",
          rule: "lookalike-letter",
          message: `"${clip(word, 40)}" has a ${/\p{Script=Greek}/u.test(odd) ? "Greek" : "Cyrillic"} "${odd}" (${hex(odd)}) posing as a Latin letter. Retype the word.`,
          ...where,
        });
      }
      if (text !== text.normalize("NFC")) {
        report("nfc", { severity: "hint", rule: "combining-marks", message: "Accented letters are built from separate combining marks. Retype them as single characters (NFC).", ...where });
      }
    }
  }
  if (copiedHits >= 3) {
    out.add({
      severity: "error",
      rule: "copied-text",
      message:
        "This file has hidden look-alike letters and zero-width spaces in several places. That pattern comes from copied text, not typed lyrics. Transcribe the lyrics from the recording yourself.",
      loud: true,
    });
  }
}

// ---------------------------------------------------------------- structure

function checkStructure(out: Findings, doc: TtmlDocument) {
  const { mode } = doc;

  if (doc.lines.length === 0) {
    out.add({
      severity: "error",
      rule: "no-lyrics",
      message: doc.droppedLines.length
        ? "Every line sits in a section Spicy Lyrics skips (Instrumental/Outro), so nothing would show."
        : "The file has no <p> lyric lines.",
    });
    return;
  }

  const droppedWithText = doc.droppedLines.filter((l) => leadText(l, mode));
  if (droppedWithText.length) {
    const part = droppedWithText[0].songPart;
    out.add({
      severity: "warning",
      rule: "skipped-section",
      message: `${droppedWithText.length} line(s) are inside a \`${clip(String(part))}\` section, which Spicy Lyrics skips; those lyrics won't show.`,
      line: droppedWithText[0],
      time: droppedWithText[0].begin,
    });
  }

  if (doc.timingAttr === "Line" && doc.lines.some((l) => l.lead.filter((s) => s.begin != null).length > 1)) {
    out.add({
      severity: "warning",
      rule: "word-timing-ignored",
      message: 'Root says itunes:timing="Line" but lines have word timing. The word timing is ignored and the file shows line-synced; use itunes:timing="Word".',
    });
  }
  if (doc.timingAttr === "None" && doc.lines.some((l) => l.begin != null || l.lead.some((s) => s.begin != null))) {
    out.add({
      severity: "warning",
      rule: "timing-ignored",
      message: 'Root says itunes:timing="None", so all the timing in the file is ignored and it shows unsynced.',
    });
  }

  const usedAgents = new Set<string>();
  const undeclared = new Map<string, Line>();
  const singleBlockLines: Line[] = [];
  const wordTimedLines = doc.lines.filter((l) => l.lead.length > 1).length;

  for (const [i, line] of doc.lines.entries()) {
    const text = leadText(line, mode);
    const bgTexts = line.backgrounds.map(backgroundText);
    const loc = { line, time: line.begin };

    if (line.agent) {
      usedAgents.add(line.agent);
      if (!doc.agents.has(line.agent) && !undeclared.has(line.agent)) undeclared.set(line.agent, line);
    }

    if (!text && !bgTexts.some(Boolean)) {
      out.add({ severity: "warning", rule: "empty-line", message: "Empty lyric line. It has nothing to show; delete it.", ...loc });
      continue;
    }

    if (mode === "Syllable") {
      if (line.directText.trim()) {
        out.add({
          severity: "error",
          rule: "text-outside-spans",
          message: `"${clip(line.directText.trim())}" is written outside any timed span, so it won't show in a word-synced file.`,
          ...loc,
        });
      }
      for (const bg of line.backgrounds) {
        if (!bg.syllables.length && bg.directText.trim()) {
          out.add({
            severity: "error",
            rule: "background-untimed",
            message: `Background vocal "${clip(bg.directText.trim())}" has no timed spans inside it, so it won't show.`,
            background: bg,
            ...loc,
          });
        }
      }
      if (line.lead.length === 1 && /\S\s+\S/.test(line.lead[0].text.trim()) && wordTimedLines >= 3) {
        singleBlockLines.push(line);
      }
    } else if (mode === "Line" && line.begin == null && line.lead.find((s) => s.begin != null) == null) {
      out.add({ severity: "error", rule: "untimed-line", message: "Line has no begin/end time.", ...loc });
    }

    if (!text && line.backgrounds.length) {
      out.add({
        severity: "warning",
        rule: i === 0 ? "starts-with-background" : "background-only-line",
        message:
          i === 0
            ? "The song starts with a background vocal. The first line needs lead lyrics."
            : "Line has a background vocal but no lead lyrics. Make it a lead line, or attach it to the line it's sung over.",
        ...loc,
      });
    }
    if (line.backgrounds.length > 1) {
      out.add({
        severity: "hint",
        rule: "stacked-backgrounds",
        message: `${line.backgrounds.length} separate background vocals on this line. This works, but more than one per line isn't fully supported or accounted for yet; if they're one phrase, merge them.`,
        ...loc,
      });
    }
    for (const role of new Set(line.unknownRoles)) {
      out.add({ severity: "warning", rule: "unknown-role", message: `Span with ttm:role="${role}" isn't a role Spicy Lyrics knows, so its text won't show.`, ...loc });
    }
    for (const s of [...line.lead, ...line.backgrounds.flatMap((b) => b.syllables)]) {
      if (s.glueMismatch) {
        out.add({
          severity: "warning",
          rule: "split-word-breaks-apart",
          message: s.gluedInMarkup
            ? `${quoteOf(s)} is written against the next syllable but will show as a separate word: ${s.glueMismatch}.`
            : `${quoteOf(s)} is written as its own word but will show joined to the next one: ${s.glueMismatch}.`,
          line,
          marks: [s],
          background: s.bg ? line.backgrounds.find((b) => b.syllables.includes(s)) : undefined,
          time: s.begin,
        });
      }
    }
  }

  if (singleBlockLines.length) {
    const first = singleBlockLines[0];
    out.add({
      severity: "warning",
      rule: "mixed-timing",
      message: `${singleBlockLines.length} line(s) are timed as one block while the rest of the song is timed word by word. Use one timing style for the whole song.`,
      line: first,
      marks: first.lead,
      time: first.begin,
    });
  }

  for (const [agent, line] of undeclared) {
    const side = agent === "v2" || agent === "v2000" ? " It shows on the main side until it's declared." : "";
    out.add({
      severity: "warning",
      rule: "agent-undeclared",
      message: `Singer \`${clip(agent, 20)}\` is used but not declared as a <ttm:agent> in the head.${side}`,
      line,
      time: line.begin,
    });
  }
  const sideless = [...usedAgents].filter((a) => !["v1", "v2", "v2000"].includes(a));
  if (usedAgents.size > 1 && sideless.length) {
    out.add({
      severity: "hint",
      rule: "agent-side",
      message: `Singer(s) ${sideless.map((a) => `\`${clip(a, 20)}\``).join(", ")} show on the same side as \`v1\`; only \`v2\`/\`v2000\` show on the opposite side.`,
    });
  }

  const keys = new Set<string>();
  for (const l of doc.lines) {
    if (l.key) keys.add(l.key);
    for (const b of l.backgrounds) if (b.key) keys.add(b.key);
  }
  const orphanRoman = doc.transliterations.filter((t) => t.for && !keys.has(t.for));
  if (orphanRoman.length) {
    out.add({
      severity: "warning",
      rule: "romanization-orphan",
      message: `${orphanRoman.length} romanization entr${orphanRoman.length === 1 ? "y points" : "ies point"} to a line key that doesn't exist (e.g. \`${clip(String(orphanRoman[0].for), 30)}\`), so it won't show.`,
    });
  }
  const emptyRoman = doc.transliterations.reduce((n, t) => n + t.emptySpans, 0);
  if (emptyRoman) {
    out.add({ severity: "warning", rule: "romanization-empty", message: `${emptyRoman} empty syllable(s) in the romanization. Fill them in or remove them.` });
  }
  const orphanTranslations = doc.translationKeys.filter((k) => !keys.has(k));
  if (orphanTranslations.length) {
    out.add({
      severity: "hint",
      rule: "translation-orphan",
      message: `${orphanTranslations.length} translation entr${orphanTranslations.length === 1 ? "y points" : "ies point"} to a line key that doesn't exist (e.g. \`${clip(orphanTranslations[0], 30)}\`).`,
    });
  }
}

// ---------------------------------------------------------------- metadata

function checkSongwriters(out: Findings, doc: TtmlDocument) {
  if (!doc.songwriters.length) {
    out.add({ severity: "warning", rule: "songwriters-missing", message: "No songwriters in the metadata. Add each writer as their own songwriter entry." });
    return;
  }
  const seen = new Set<string>();
  for (const sw of doc.songwriters) {
    const name = sw.trim();
    if (!name) {
      out.add({ severity: "warning", rule: "songwriter-empty", message: "Empty songwriter entry." });
      continue;
    }
    if (/[,;/]|\s&\s|\sand\s|\s[x×]\s/i.test(name)) {
      out.add({ severity: "warning", rule: "songwriter-several-names", message: `Songwriter entry "${clip(name)}" looks like several people. Add each one separately.` });
    }
    const key = name.toLowerCase();
    if (seen.has(key)) out.add({ severity: "hint", rule: "songwriter-duplicate", message: `Songwriter "${clip(name)}" is listed twice.` });
    seen.add(key);
  }
}

// ---------------------------------------------------------------- timing

function checkTimestamps(out: Findings, doc: TtmlDocument) {
  for (const line of doc.lines) {
    const bad: string[] = [];
    if (line.rawBegin !== undefined && line.begin == null) bad.push(line.rawBegin);
    if (line.rawEnd !== undefined && line.end == null) bad.push(line.rawEnd);
    for (const s of [...line.lead, ...line.backgrounds.flatMap((b) => b.syllables)]) {
      if (s.rawBegin !== undefined && s.begin == null) bad.push(s.rawBegin);
      if (s.rawEnd !== undefined && s.end == null) bad.push(s.rawEnd);
    }
    if (bad.length) {
      out.add({
        severity: "error",
        rule: "bad-timestamp",
        message: `Timestamp \`${clip(bad[0], 30)}\` can't be read. Use mm:ss.mmm (or hh:mm:ss.mmm).`,
        line,
        time: line.begin,
      });
    }
  }
}

function checkSyllableTiming(out: Findings, line: Line, syllables: Syllable[], bg?: Background) {
  const lead = !bg;
  const words = wordsOf(syllables);
  for (const [i, s] of syllables.entries()) {
    const at = { line, background: bg, marks: [s], time: s.begin };
    if (s.begin == null || s.end == null) {
      if (s.rawBegin === undefined || s.rawEnd === undefined) {
        out.add({ severity: "error", rule: "untimed-syllable", message: `${quoteOf(s)} has no begin/end time.`, ...at, time: line.begin });
      }
      continue;
    }
    if (!s.text.trim()) {
      out.add({ severity: "error", rule: "empty-syllable", message: "Timed syllable with no text (only spaces). Delete it or type the lyric.", ...at });
    }
    if (s.begin < -SAME_INSTANT) {
      out.add({ severity: "error", rule: "negative-time", message: `${quoteOf(s)} is timed before the song starts (${formatTime(s.begin)}).`, ...at });
    }
    const length = s.end - s.begin;
    if (length < -SAME_INSTANT) {
      out.add({ severity: "error", rule: "ends-before-start", message: `${quoteOf(s)} has its end (${formatTime(s.end)}) before its start (${formatTime(s.begin)}); swap or retime them.`, ...at });
    } else if (length < SAME_INSTANT) {
      out.add({ severity: "warning", rule: "zero-length", message: `${quoteOf(s)} starts and ends at the same moment (${formatTime(s.begin)}), so it never lights up.`, ...at });
    } else if (length > LONG_SYLLABLE) {
      out.add({ severity: "hint", rule: "very-long-syllable", message: `${quoteOf(s)} is held for ${length.toFixed(1)} s. Check it doesn't stretch across an instrumental gap.`, ...at });
    }

    const next = syllables[i + 1];
    if (!next || next.begin == null || next.end == null) continue;
    if (next.begin < s.begin - SAME_INSTANT) {
      out.add({
        severity: lead ? "warning" : "hint",
        rule: "syllables-out-of-order",
        message:
          `${quoteOf(next)} (${formatTime(next.begin)}) is timed earlier than ${quoteOf(s)} (${formatTime(s.begin)}), which comes before it in the line.` +
          (lead ? "" : " Fine if two voices share this background vocal."),
        line,
        background: bg,
        marks: [s, next],
        time: next.begin,
      });
      continue;
    }
    const overlap = s.end - next.begin;
    if (overlap > INAUDIBLE_OVERLAP) {
      const held = overlap > HELD_NOTE_OVERLAP;
      out.add({
        severity: lead && !held ? "warning" : "hint",
        rule: "syllable-overlap",
        message: !lead
          ? `${quoteOf(s)} is still going ${ms(overlap)} after ${quoteOf(next)} starts. Fine if two voices share this background vocal.`
          : held
            ? `${quoteOf(s)} is still going ${ms(overlap)} after ${quoteOf(next)} starts. Fine for a held note, otherwise end it where the next one begins.`
            : `${quoteOf(s)} ends ${ms(overlap)} after ${quoteOf(next)} starts. Snap the boundary so both use ${formatTime(next.begin)}.`,
        line,
        background: bg,
        marks: [s, next],
        time: next.begin,
      });
    } else if (s.glued && -overlap > AUDIBLE_WORD_GAP) {
      out.add({
        severity: "hint",
        rule: "gap-inside-word",
        message: `"${(words.find((w) => w.includes(s)) ?? [s]).map(shownText).join("")}" pauses for ${ms(-overlap)} between ${quoteOf(s)} and ${quoteOf(next)}. If the word is sung through, close the gap.`,
        line,
        background: bg,
        marks: [s, next],
        time: s.end,
      });
    }
  }
}

function checkTiming(out: Findings, doc: TtmlDocument) {
  checkTimestamps(out, doc);
  if (doc.mode !== "Syllable") return;

  for (const line of doc.lines) {
    checkSyllableTiming(out, line, line.lead);
    for (const bg of line.backgrounds) checkSyllableTiming(out, line, bg.syllables, bg);

    const timed = line.lead.filter((s) => s.begin != null && s.end != null);
    if (!timed.length) continue;
    const first = Math.min(...timed.map((s) => s.begin!));
    const last = Math.max(...timed.map((s) => s.end!));
    if (line.begin == null || line.end == null) {
      if (line.rawBegin === undefined || line.rawEnd === undefined) {
        out.add({ severity: "warning", rule: "untimed-line", message: "Line (<p>) has no begin/end time of its own.", line, time: first });
      }
    } else {
      if (line.begin - first > 0.25) {
        out.add({
          severity: "warning",
          rule: "line-starts-late",
          message: `The first word starts ${ms(line.begin - first)} before its line does (${formatTime(first)} vs ${formatTime(line.begin)}).`,
          line,
          marks: [timed[0]],
          time: first,
        });
      }
      if (last - line.end > 0.25) {
        out.add({
          severity: "warning",
          rule: "line-ends-early",
          message: `The last word ends ${ms(last - line.end)} after its line does (${formatTime(last)} vs ${formatTime(line.end)}).`,
          line,
          marks: [timed[timed.length - 1]],
          time: line.end,
        });
      }
    }
  }

  // Order of lines, and identical lines stacked on each other.
  const seen = new Map<string, Line>();
  let prev: Line | undefined;
  for (const line of doc.lines) {
    const start = line.begin ?? line.lead.find((s) => s.begin != null)?.begin ?? null;
    if (start == null) continue;
    const prevStart = prev ? prev.begin ?? prev.lead.find((s) => s.begin != null)?.begin ?? null : null;
    if (prev && prevStart != null && start < prevStart - 0.5) {
      out.add({
        severity: "warning",
        rule: "lines-out-of-order",
        message: `Line starts at ${formatTime(start)}, before line ${prev.n} (${formatTime(prevStart)}). Lines show in file order, so move it.`,
        line,
        time: start,
      });
    }
    const text = leadText(line, doc.mode).toLowerCase();
    const key = `${text}\0${start.toFixed(3)}`;
    if (text && seen.has(key)) {
      out.add({ severity: "warning", rule: "duplicate-line", message: `Same words at the same time as line ${seen.get(key)!.n}. Delete one.`, line, time: start });
    } else seen.set(key, line);
    prev = line;
  }

  if (doc.bodyDur != null) {
    const ends = doc.lines.flatMap((l) => [...l.lead, ...l.backgrounds.flatMap((b) => b.syllables)]).map((s) => s.end ?? 0);
    const lastEnd = Math.max(0, ...ends);
    if (lastEnd > doc.bodyDur + 1) {
      out.add({ severity: "hint", rule: "past-song-end", message: `Last lyric ends at ${formatTime(lastEnd)}, after the song length in the file (${formatTime(doc.bodyDur)}).` });
    }
  }
}

// ---------------------------------------------------------------- text

const HYPHENS = "-‐‑";
const isHyphen = (ch: string) => ch !== "" && HYPHENS.includes(ch);
// Apostrophes stay: they belong to the word in 'til, 'cause and rockin'.
const EDGE_PUNCTUATION = `"“”(),.!?;:[]{}¿¡`;

/** A token with the punctuation around it peeled off; apostrophes inside a word stay. */
function bare(token: string): string {
  let start = 0;
  let end = token.length;
  while (start < end && EDGE_PUNCTUATION.includes(token[start])) start++;
  while (end > start && EDGE_PUNCTUATION.includes(token[end - 1])) end--;
  return token.slice(start, end);
}

const SECTION_WORDS = new Set([
  "intro", "verse", "prechorus", "chorus", "postchorus", "bridge", "outro", "hook",
  "refrain", "instrumental", "interlude", "break", "drop", "breakdown", "skit",
]);

// Section names that are also everyday lyrics ("Drop", "Break"); alone on a
// line they only count as a label with a number, a colon or parentheses.
const AMBIGUOUS_SECTION_WORDS = new Set(["break", "drop", "hook", "bridge", "skit"]);

/** A line that only names a song section: [Chorus], Verse 2:, (Bridge)… */
function isSectionLabel(text: string): boolean {
  const t = text.trim();
  if (t.startsWith("[") && t.endsWith("]")) return true;
  const words = t.toLowerCase().split(/\s+/).map(bare).filter(Boolean);
  if (words.length === 0 || words.length > 3) return false;
  const numbered = words.some((w) => /^\d+$/.test(w));
  const label = words.filter((w) => !/^\d+$/.test(w)).join("").replace(/-/g, "");
  if (!SECTION_WORDS.has(label) || t.length > 24) return false;
  const marked = numbered || t.endsWith(":") || (t.startsWith("(") && t.endsWith(")"));
  return marked || !AMBIGUOUS_SECTION_WORDS.has(label);
}

/** The first [ … ] in the line, if it has both ends. */
function bracketedNote(text: string): string | null {
  const open = text.indexOf("[");
  const close = open === -1 ? -1 : text.indexOf("]", open);
  return close === -1 ? null : text.slice(open, close + 1);
}

/** Whether the line ends in a repeat count (x2, ×4, 2x) or a "repeat" instruction. */
function endsInRepeatCount(tokens: string[]): boolean {
  const tail = tokens.slice(-2).join("").toLowerCase();
  const last = bare(tokens[tokens.length - 1] ?? "").toLowerCase();
  const count = (s: string) => {
    const c = s.replace(/[()[\]\s]/g, "");
    const marker = c[0] === "x" || c[0] === "×" ? c.slice(1) : c.endsWith("x") || c.endsWith("×") ? c.slice(0, -1) : null;
    return marker !== null && marker.length > 0 && marker.length <= 2 && [...marker].every((ch) => ch >= "0" && ch <= "9");
  };
  return count(bare(tokens[tokens.length - 1] ?? "")) || count(tail) || last === "repeat";
}

/** True when a censor token isn't the bare four-asterisk form. */
function badCensor(token: string): boolean {
  return token.includes("*") && bare(token) !== "****";
}

/** "You get-you get": a hyphen joining two runs of the same phrase. */
function hyphenatedRepeat(tokens: string[]): string | null {
  for (let i = 1; i + 1 < tokens.length; i++) {
    const parts = tokens[i].split("-");
    if (parts.length !== 2 || !parts[0] || !parts[1]) continue;
    // A phrase of two different words; "yeah, yeah-yeah, yeah" is one word repeated, which is fine.
    if (bare(tokens[i - 1]).toLowerCase() === parts[0].toLowerCase()) continue;
    if (bare(tokens[i - 1]) !== tokens[i - 1] || bare(parts[1]) !== parts[1]) continue;
    const before = `${tokens[i - 1]} ${parts[0]}`.toLowerCase();
    const after = `${parts[1]} ${bare(tokens[i + 1])}`.toLowerCase();
    if (bare(before) === bare(after)) return `${tokens[i - 1]} ${tokens[i]} ${tokens[i + 1]}`;
  }
  return null;
}

const ABBREVIATIONS = new Set(["mr.", "mrs.", "ms.", "dr.", "st.", "jr.", "sr.", "vs.", "etc.", "a.m.", "p.m.", "a.k.a.", "u.s.", "d.c.", "l.a."]);

function endsWithStrayPeriod(tokens: string[]): boolean {
  const last = (tokens[tokens.length - 1] ?? "").toLowerCase();
  if (!last.endsWith(".") || last.endsWith("..")) return false;
  if (ABBREVIATIONS.has(bare(last).toLowerCase() + ".") || ABBREVIATIONS.has(last)) return false;
  // Initials and dotted acronyms (D.C., R.I.P.) end on a period too.
  return (last.match(/\./g) ?? []).length === 1;
}

function hasRunOf(text: string, chars: string): string | null {
  for (let i = 0; i + 1 < text.length; i++) {
    if (chars.includes(text[i]) && chars.includes(text[i + 1])) {
      let j = i + 1;
      while (j + 1 < text.length && chars.includes(text[j + 1])) j++;
      return text.slice(i, j + 1);
    }
  }
  return null;
}

/** A slash that isn't between two digits (24/7 is fine). */
function hasStraySlash(text: string): boolean {
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "/" && text[i] !== "\\") continue;
    const digit = (c: string | undefined) => c !== undefined && c >= "0" && c <= "9";
    if (!(digit(text[i - 1]) && digit(text[i + 1]))) return true;
  }
  return false;
}

/** A hyphen or en dash used as a stand-alone dash, or two hyphens for one. */
function hasStandInDash(tokens: string[], text: string): boolean {
  return text.includes("–") || text.includes("--") || tokens.some((t) => t === "-");
}

const PRONOUN_I = new Set(["i", "i'm", "i've", "i'll", "i'd"]);

// Vocalisations that are written stretched on purpose.
const VOCALISATIONS = new Set(["oh", "ooh", "ah", "ahh", "aah", "mm", "mmm", "hm", "hmm", "uh", "eh", "ay", "ayy", "la", "na", "da", "woo", "whoo", "yo", "brr", "grr", "shh", "psst", "skrrt", "sh", "zz"]);
const HELD_WORDS = new Set(["so", "go", "no", "yeah", "baby", "love", "please", "now", "stay", "home", "away", "fly", "high", "cry", "why", "night", "free", "feel", "need", "see", "die", "alive", "down", "gone", "forever", "goodbye", "hey", "yes", "nah"]);

/** "Sooo" → "so": a word stretched to show a held note, or null. */
function stretchedWord(token: string): string | null {
  const lower = token.toLowerCase().replace(/'/g, "");
  if (!/(\p{L})\1\1/u.test(lower)) return null;
  const single = lower.replace(/(\p{L})\1+/gu, "$1");
  const double = lower.replace(/(\p{L})\1{2,}/gu, "$1$1");
  if (VOCALISATIONS.has(single) || VOCALISATIONS.has(double) || VOCALISATIONS.has(lower)) return null;
  if (ENGLISH_MARKERS.has(double) || HELD_WORDS.has(double)) return double;
  if (ENGLISH_MARKERS.has(single) || HELD_WORDS.has(single)) return single;
  return null;
}

// Standard spellings for English lyrics, as preferred form → forms to replace.
// Looked up per word or pair of words, lowercase.
const STANDARD_SPELLINGS: { preferred: string; variants: string[]; note?: string }[] = [
  { preferred: "okay", variants: ["ok", "o.k", "o.k."] },
  { preferred: "alright", variants: ["all right"], note: `when it means "okay"` },
  { preferred: "naive", variants: ["naïve"] },
  { preferred: "I'ma", variants: ["i'mma", "imma", "ima"] },
  { preferred: "'cause", variants: ["cos", "cuz"], note: `when it means "because"` },
  { preferred: "'til", variants: ["til"], note: `when it's short for "until"` },
  { preferred: "tryna", variants: ["trynna"] },
  { preferred: "though", variants: ["tho"] },
  { preferred: "y'all", variants: ["ya'll", "yall"] },
  { preferred: "skrrt", variants: ["skrt"] },
  { preferred: "bougie", variants: ["boujee", "boujie"] },
  { preferred: "woah", variants: ["whoa"] },
  { preferred: "dog", variants: ["dawg"] },
  { preferred: "dogs", variants: ["dawgs"] },
  { preferred: "chopper", variants: ["choppa"] },
  { preferred: "choppers", variants: ["choppas"] },
  { preferred: "oughta", variants: ["oughtta"] },
  { preferred: "cliché", variants: ["cliche"] },
  { preferred: "GOAT", variants: ["g.o.a.t", "g.o.a.t."] },
  { preferred: "VIP", variants: ["v.i.p", "v.i.p."] },
  { preferred: "ASAP", variants: ["a.s.a.p", "a.s.a.p."] },
];
const SPELLING_LOOKUP = new Map<string, { preferred: string; note?: string }>();
for (const entry of STANDARD_SPELLINGS) for (const v of entry.variants) SPELLING_LOOKUP.set(v, entry);

function checkText(out: Findings, doc: TtmlDocument, english: boolean, lowerStyle: boolean) {
  for (const line of doc.lines) {
    const parts: { text: string; bg?: Background }[] = [{ text: leadText(line, doc.mode) }];
    for (const bg of line.backgrounds) parts.push({ text: backgroundText(bg), bg });

    for (const { text, bg } of parts) {
      if (!text) continue;
      const tokens = text.split(/\s+/).filter(Boolean);
      const at = { line, background: bg, time: line.begin };
      const add = (severity: Severity, rule: string, message: string) => out.add({ severity, rule, message, ...at });

      const note = bracketedNote(text);
      if (isSectionLabel(text)) add("warning", "section-label", "This is a section label, not a lyric. Remove the line; only what's sung goes in.");
      else if (note) add("warning", "bracketed-note", `\`${clip(note, 40)}\` isn't sung. Notes like [?], [laughs] or [Chorus] don't belong in the lyrics.`);
      if (endsInRepeatCount(tokens)) add("warning", "repeat-shorthand", "Uses repeat shorthand. Every repeat has to be written out and timed where it's sung.");
      if (text.includes("...") || text.includes("…")) add("warning", "ellipsis", "Has an ellipsis. Gaps are left blank, and a cut-off word ends in an em dash (—).");
      const censor = tokens.find(badCensor);
      if (censor) add("warning", "censor-format", `\`${clip(censor, 20)}\`: a bleeped word is written as exactly four asterisks, \`****\`, standing alone.`);
      const repeat = hyphenatedRepeat(tokens);
      if (repeat) add("warning", "phrase-hyphen", `\`${clip(repeat, 40)}\`: repeats of a phrase are separated by a comma or an em dash, not a hyphen.`);

      const stacked = hasRunOf(text, "!?");
      if (stacked) add("hint", "stacked-punctuation", `\`${stacked}\`: one ? or ! is enough.`);
      if (endsWithStrayPeriod(tokens)) add("hint", "trailing-period", "Drop the period at the end of the line.");
      const dash = text.indexOf("—");
      if (dash !== -1 && ",.;:!?".includes(text[dash + 1] ?? " ")) add("hint", "dash-punctuation", "Nothing follows an em dash; remove the punctuation after it.");
      if (hasStandInDash(tokens, text)) add("hint", "fake-dash", "A hyphen or en dash is standing in for a dash. Use an em dash (—) for a cut-off, or a comma for a pause.");
      if (hasStraySlash(text)) add("hint", "slash", "Has a slash, which isn't sung. Pick one of the alternatives, or split the line.");
      if (text.length > 110) add("hint", "long-line", `${text.length} characters is long for one line on screen. If there's a natural pause, break it there.`);

      // The first word, past any opening quote or bracket; lines opening on a number or dash are left alone.
      // Background vocals are adlibs, which are often written in lowercase on purpose.
      const word = bare(tokens[0] ?? "");
      const head = word.charAt(0);
      if (!bg && !lowerStyle &&LATIN_LETTER.test(head) && head !== head.toUpperCase() && !/^\p{Ll}+\p{Lu}/u.test(word)) {
        add("hint", "lowercase-start", `Starts with "${clip(word, 20)}"; capitalize the first word of the line.`);
      }
      if (english) {
        const words = tokens.map(bare);
        const stretched = words.map((w) => [w, stretchedWord(w)] as const).find(([, plain]) => plain);
        if (stretched) add("hint", "stretched-spelling", `"${clip(stretched[0], 20)}" spells out a held note. Write "${stretched[1]}"; the timing already holds it.`);
        const pronoun = words.find((w) => PRONOUN_I.has(w));
        if (pronoun) add("hint", "lowercase-i", `"${pronoun}" is the pronoun, so it's "${cap(pronoun)}".`);
        const seen = new Set<string>();
        for (const [i, w] of words.entries()) {
          const lower = w.toLowerCase();
          const pair = i + 1 < words.length ? SPELLING_LOOKUP.get(`${lower} ${words[i + 1].toLowerCase()}`) : undefined;
          const entry = pair ?? SPELLING_LOOKUP.get(lower) ?? SPELLING_LOOKUP.get(lower.replace(/\.$/, ""));
          if (!entry || seen.has(entry.preferred)) continue;
          seen.add(entry.preferred);
          const found = pair ? `${w} ${words[i + 1]}` : w;
          add("hint", "spelling", `"${clip(found, 20)}": the standard spelling is "${entry.preferred}"${entry.note ? ` ${entry.note}` : ""}.`);
        }
      }
    }

    if (doc.mode === "Syllable") checkHyphens(out, line);
  }

  if (doc.mode === "Syllable") {
    for (const line of doc.lines) {
      const text = leadText(line, doc.mode);
      const open = text.indexOf("(");
      const wholeLine = text.trim().startsWith("(") && text.trim().endsWith(")");
      if (open !== -1 && !wholeLine) {
        const close = text.indexOf(")", open);
        out.add({
          severity: "warning",
          rule: "adlib-in-lead",
          message: `\`${clip(text.slice(open, close === -1 ? undefined : close + 1), 40)}\` is typed into the lead line. If it's sung over the line, move it into a background vocal so it's timed on its own.`,
          line,
          time: line.begin,
        });
      }
    }
  }
  checkBrackets(out, doc);
}

function checkHyphens(out: Findings, line: Line) {
  const groups: { syllables: Syllable[]; bg?: Background }[] = [{ syllables: line.lead }];
  for (const bg of line.backgrounds) groups.push({ syllables: bg.syllables, bg });
  for (const { syllables, bg } of groups) {
    for (const word of wordsOf(syllables)) {
      const k = word.findIndex((s, i) => i > 0 && isHyphen(s.text.trimStart().charAt(0)));
      if (k === -1) continue;
      const pieces = word.map(shownText);
      const fixed = [...pieces];
      for (let i = 1; i < fixed.length; i++) {
        const lead = fixed[i].length - fixed[i].replace(/^[-‐‑]+/, "").length;
        fixed[i - 1] += fixed[i].slice(0, lead);
        fixed[i] = fixed[i].slice(lead);
      }
      out.add({
        severity: "warning",
        rule: "hyphen-wrong-side",
        message: `"${pieces.join("")}" is cut as ${pieces.join("|")}, so the hyphen lights up with the wrong syllable. Cut it as ${fixed.filter(Boolean).join("|")}.`,
        line,
        background: bg,
        marks: [word[k - 1], word[k]],
        time: word[k].begin,
      });
    }
    for (const [i, s] of syllables.entries()) {
      const t = s.text.trimEnd();
      if (!isHyphen(t.charAt(t.length - 1)) || s.glued) continue;
      const next = syllables[i + 1];
      if (!next) {
        out.add({
          severity: "hint",
          rule: "hyphen-line-end",
          message: `The line ends on ${quoteOf(s)}. A word cut off mid-way ends in an em dash (—), not a hyphen.`,
          line,
          background: bg,
          marks: [s],
          time: s.begin,
        });
      } else {
        out.add({
          severity: "warning",
          rule: "hyphen-gap",
          message: `Shows as "${shownText(s)} ${shownText(next)}" with a space after the hyphen. ${/\s$/.test(s.text) ? `Delete the space at the end of ${quoteOf(s)}.` : "Put the two spans directly against each other."}`,
          line,
          background: bg,
          marks: [s, next],
          time: s.begin,
        });
      }
    }
  }
}

function checkBrackets(out: Findings, doc: TtmlDocument) {
  const closing: Record<string, string> = { "(": ")", "[": "]", "{": "}" };
  const opening: Record<string, string> = { ")": "(", "]": "[", "}": "{" };
  const open: { ch: string; line: Line }[] = [];
  let openQuote: Line | null = null;
  // Lyrics can quote across several lines, so the whole song is one stream.
  for (const line of doc.lines) {
    for (const ch of leadText(line, doc.mode)) {
      if (closing[ch]) open.push({ ch, line });
      else if (opening[ch]) {
        if (open.length && open[open.length - 1].ch === opening[ch]) open.pop();
        else out.add({ severity: "hint", rule: "unbalanced-brackets", message: `There's a "${ch}" here without a matching "${opening[ch]}" before it.`, line, time: line.begin });
      } else if (ch === '"') openQuote = openQuote ? null : line;
    }
  }
  for (const { ch, line } of open) {
    out.add({ severity: "hint", rule: "unbalanced-brackets", message: `This "${ch}" is never matched by a "${closing[ch]}".`, line, time: line.begin });
  }
  if (openQuote) out.add({ severity: "hint", rule: "unbalanced-brackets", message: "A quotation starts here and is never closed.", line: openQuote, time: openQuote.begin });
}

// ---------------------------------------------------------------- document style

// Short, frequent English words: enough of them in a Latin-script lyric means English.
const ENGLISH_MARKERS = new Set(
  "the a an and but or of to in on at for with from is are was were be been am i you he she we they it me him her us them my your our their this that not no do don't can't won't i'm you're it's what when where why how all".split(" ")
);

function isEnglish(doc: TtmlDocument): boolean {
  if (doc.lang) return /^en\b/i.test(doc.lang);
  const text = doc.lines.map((l) => leadText(l, doc.mode)).join(" ");
  const letters = text.match(/\p{L}/gu) ?? [];
  if (letters.length < 20) return false;
  const latin = letters.filter((c) => LATIN_LETTER.test(c)).length;
  const words = text.toLowerCase().match(/[a-z']+/g) ?? [];
  const markers = words.filter((w) => ENGLISH_MARKERS.has(w)).length;
  return latin / letters.length >= 0.7 && markers / Math.max(words.length, 1) >= 0.15;
}

type CaseKind = "lower" | "upper" | "title" | "";

function caseOf(text: string): CaseKind {
  // A spelled-out word (B-O-Y) is capitals by nature and says nothing about the line.
  const spelledOut = (w: string) => /^(?:\p{L}[-—])+\p{L}\W*$/u.test(w);
  const words = text.split(/\s+/).filter((w) => /\p{L}/u.test(w) && !spelledOut(w));
  if (words.length < 2) return "";
  const joined = words.join("");
  const hasUpper = /\p{Lu}/u.test(joined);
  const hasLower = /\p{Ll}/u.test(joined);
  if (hasLower && !hasUpper && !/\p{Lu}/u.test(text)) return "lower";
  if (hasUpper && !hasLower) return "upper";
  if (words.length >= 4 && words.every((w) => /^\P{L}*\p{Lu}/u.test(w))) return "title";
  return "";
}

/** Returns true when the whole song is written in lowercase on purpose. */
function checkCase(out: Findings, doc: TtmlDocument): boolean {
  const lines = doc.lines.filter((l) => leadText(l, doc.mode));
  const kinds = lines.map((line) => ({ line, kind: caseOf(leadText(line, doc.mode)) }));
  const tally: Record<string, number> = {};
  for (const { kind } of kinds) if (kind) tally[kind] = (tally[kind] ?? 0) + 1;
  const dominant = Object.keys(tally).find((k) => lines.length >= 6 && tally[k] / lines.length >= 0.6);
  const describe: Record<string, string> = {
    lower: "are written without any capital letters",
    upper: "are written in all caps",
    title: "capitalize every word",
  };
  if (dominant) {
    out.add({ severity: "hint", rule: `case-${dominant}`, message: `${tally[dominant]} of ${lines.length} lines ${describe[dominant]}. Lyrics use sentence case: capitalize the first word and names.` });
  }
  if (dominant !== "upper") {
    for (const { line, kind } of kinds) {
      if (kind === "upper" && (leadText(line, doc.mode).match(/\p{L}/gu) ?? []).length >= 8) {
        out.add({ severity: "hint", rule: "case-upper", message: "This line is in all caps. Use normal capitalization, even when it's shouted.", line, time: line.begin });
      }
    }
  }
  return dominant === "lower";
}

// ---------------------------------------------------------------- splits

const VOWEL = /[aeiouyàáâäãåèéêëìíîïòóôöõøùúûüæœ]/i;

function checkSplits(out: Findings, doc: TtmlDocument) {
  if (doc.mode !== "Syllable") return;
  const arrangements = new Map<string, Map<string, { count: number; line: Line; syllables: Syllable[] }>>();
  for (const line of doc.lines) {
    const groups: { syllables: Syllable[]; bg?: Background }[] = [{ syllables: line.lead }];
    for (const bg of line.backgrounds) groups.push({ syllables: bg.syllables, bg });
    for (const { syllables, bg } of groups) {
      for (const word of wordsOf(syllables)) {
        if (word.length < 2) continue;
        const shown = word.map(shownText);
        const letters = shown.map((p) => p.replace(/[^\p{L}']/gu, ""));
        const whole = letters.join("");
        // Ordinary Latin words only; initialisms, CamelCase, numbers and vowelless interjections are left alone.
        if (!/^[a-zA-Z']+$/.test(whole) || /[A-Z]{2}/.test(whole) || /[a-z][A-Z]/.test(whole) || !VOWEL.test(whole)) continue;

        // A stutter typed as glued syllables renders as one run-on word ("ddo").
        // Only a vowelless fragment counts, so words like co|coon or pa|pa don't.
        const stutter = letters.findIndex(
          (p, i) =>
            i + 1 < letters.length &&
            p.length > 0 &&
            p.length <= 3 &&
            !VOWEL.test(p) &&
            !/[-—]$/.test(shown[i]) &&
            !/^[-—]/.test(shown[i + 1]) &&
            letters[i + 1].length > p.length &&
            letters[i + 1].toLowerCase().startsWith(p.toLowerCase())
        );
        if (stutter !== -1) {
          const fixed = shown.map((p, i) => (i === stutter ? `${p}-` : p));
          out.add({
            severity: "warning",
            rule: "stutter-unhyphenated",
            message: `Shows as "${shown.join("")}". A stutter takes a hyphen: ${fixed.join("|")} ("${fixed.join("")}").`,
            line,
            background: bg,
            marks: [word[stutter], word[stutter + 1]],
            time: word[stutter].begin,
          });
        } else {
          // Hyphenated pieces (stutters, spelled-out letters), abbreviations (a.|m.) and
          // contractions cut at the apostrophe (We'|ll) are cut on purpose.
          const consonants = letters.find(
            (p, i) =>
              p &&
              !VOWEL.test(p) &&
              !/['.]/.test(shown[i]) &&
              !/[-—']$/.test(shown[i - 1] ?? "") &&
              !/[-—]$/.test(shown[i]) &&
              !/^[-—]/.test(shown[i + 1] ?? "")
          );
          if (consonants) {
            out.add({
              severity: "hint",
              rule: "split-no-vowel",
              message: `"${shown.join("")}" is cut as ${shown.join("|")}, and "${consonants}" has no vowel of its own. Unless that sound is really held apart, join it to its neighbour.`,
              line,
              background: bg,
              marks: word,
              time: word[0].begin,
            });
          }
        }

        const key = whole.toLowerCase().replace(/'/g, "");
        const shape = letters.join("|").toLowerCase().replace(/'/g, "");
        const shapes = arrangements.get(key) ?? new Map();
        const entry = shapes.get(shape) ?? { count: 0, line, syllables: word };
        entry.count++;
        shapes.set(shape, entry);
        arrangements.set(key, shapes);
      }
    }
  }
  for (const shapes of arrangements.values()) {
    if (shapes.size < 2) continue;
    const ranked = [...shapes.entries()].sort((a, b) => b[1].count - a[1].count);
    const first = [...shapes.values()].sort((a, b) => a.line.n - b.line.n)[0];
    out.add({
      severity: "hint",
      rule: "split-inconsistent",
      message: `"${first.syllables.map(shownText).join("")}" is cut ${shapes.size} different ways (${ranked.map(([s, e]) => `${s} ×${e.count}`).join(", ")}). Pick one unless it's sung differently.`,
      line: first.line,
      marks: first.syllables,
      time: first.syllables[0].begin,
    });
  }
}

// ---------------------------------------------------------------- entry

// Clips user text for a message; backticks are swapped so they can never close a code span.
function clip(s: string, max = 60): string {
  const t = s.replace(/`/g, "ˋ");
  return t.length > max ? t.slice(0, max - 1) + "…" : t;
}

export function runChecks(doc: TtmlDocument): Finding[] {
  const out = new Findings();
  if (doc.xmlProblem) {
    out.add({
      severity: "warning",
      rule: "xml-malformed",
      message: `The XML is broken (line ${doc.xmlProblem.line}: ${doc.xmlProblem.message}). Spicy Lyrics reads past it, but most other tools won't; re-export the file.`,
    });
  }
  checkStructure(out, doc);
  if (!doc.lines.length) return out.items;
  checkSongwriters(out, doc);
  checkTiming(out, doc);
  checkCharacters(out, doc);
  const lowerStyle = checkCase(out, doc);
  const english = isEnglish(doc);
  checkText(out, doc, english, lowerStyle);
  if (english) checkSplits(out, doc);
  return out.items;
}
