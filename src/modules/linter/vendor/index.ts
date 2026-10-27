import { runChecks, type Finding, type Severity } from "./checks";
import { parseTtml, TtmlParseError, type TtmlDocument } from "./model";

export type { Finding, Severity };

export interface LintResult {
  /** False when Spicy Lyrics can't load the file; null when the file was refused unread. */
  loads: boolean | null;
  doc: TtmlDocument | null;
  findings: Finding[];
  /** Totals over every finding, including any left out by the cap. */
  counts: Record<Severity, number>;
  /** Findings dropped because the file had too many to list. */
  omitted: number;
}

// Rules that mean the file won't load, on top of anything that stops the parse.
const BLOCKING = new Set(["no-lyrics"]);
// Refused before parsing, so whether it would load is unknown.
const UNREAD = new Set(["doctype"]);
const ORDER: Record<Severity, number> = { error: 0, warning: 1, hint: 2 };
const MAX_FINDINGS = 1500;

export function lintTtml(raw: string): LintResult {
  let doc: TtmlDocument | null = null;
  let findings: Finding[];
  let loads: boolean | null = true;
  try {
    doc = parseTtml(raw.replace(/^﻿/, ""));
    findings = runChecks(doc);
  } catch (err) {
    if (!(err instanceof TtmlParseError)) throw err;
    loads = UNREAD.has(err.rule) ? null : false;
    const where = err.lineNumber ? ` (XML line ${err.lineNumber})` : "";
    findings = [{ severity: "error", rule: err.rule, message: err.message + where }];
  }
  if (loads && findings.some((f) => BLOCKING.has(f.rule))) loads = false;

  const counts: Record<Severity, number> = { error: 0, warning: 0, hint: 0 };
  for (const f of findings) counts[f.severity]++;

  // A file that's wrong everywhere is capped, keeping the most serious findings.
  const byLine = (a: Finding, b: Finding) => (a.line ? a.line.n : 0) - (b.line ? b.line.n : 0);
  let omitted = 0;
  if (findings.length > MAX_FINDINGS) {
    findings.sort((a, b) => ORDER[a.severity] - ORDER[b.severity] || byLine(a, b));
    omitted = findings.length - MAX_FINDINGS;
    findings = findings.slice(0, MAX_FINDINGS);
  }
  findings.sort((a, b) => byLine(a, b) || ORDER[a.severity] - ORDER[b.severity]);
  return { loads, doc, findings, counts, omitted };
}
