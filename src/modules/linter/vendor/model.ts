import { XMLParser, XMLValidator } from "fast-xml-parser";

// Same ceiling the lyrics API enforces before it will parse a TTML.
export const MAX_TTML_CHARS = 262144;

export type LyricsMode = "Syllable" | "Line" | "Static";

export interface Syllable {
  /** Entity-decoded text exactly as written in the span, untrimmed. */
  text: string;
  rawBegin?: string;
  rawEnd?: string;
  begin: number | null;
  end: number | null;
  /** Whether the API joins this syllable to the next one (IsPartOfWord). */
  glued: boolean;
  /** Whether the markup itself writes the next syllable straight against this one. */
  gluedInMarkup: boolean;
  /** Set when glued/gluedInMarkup disagree, with the reason the API lookup missed. */
  glueMismatch?: string;
  bg: boolean;
}

export interface Background {
  syllables: Syllable[];
  /** Text written directly in the x-bg span, outside any inner span. */
  directText: string;
  key?: string;
}

export interface Line {
  /** 1-based position among all <p> elements. */
  n: number;
  rawBegin?: string;
  rawEnd?: string;
  begin: number | null;
  end: number | null;
  agent?: string;
  key?: string;
  songPart?: string;
  /** Lead vocal syllables, in document order. */
  lead: Syllable[];
  backgrounds: Background[];
  /** Text written directly in the <p>, outside any span. */
  directText: string;
  roman: string[];
  translation: string[];
  unknownRoles: string[];
}

export interface TransliterationEntry {
  for?: string;
  emptySpans: number;
}

export interface TtmlDocument {
  raw: string;
  /** Well-formedness error the lenient parse read past, if any. */
  xmlProblem?: { message: string; line: number };
  /** xml:lang on the root, when set. */
  lang?: string;
  timingAttr?: string;
  /** How the API will read the file, or null when it rejects it outright. */
  mode: LyricsMode | null;
  modeInferred: boolean;
  lines: Line[];
  /** Lines from divs the API skips (Instrumental, and Outro for unsynced files). */
  droppedLines: Line[];
  agents: Map<string, string | undefined>;
  songwriters: string[];
  meta: Map<string, string>;
  bodyDur: number | null;
  transliterations: TransliterationEntry[];
  translationKeys: string[];
}

export class TtmlParseError extends Error {
  constructor(
    public readonly rule: string,
    message: string,
    public readonly lineNumber?: number
  ) {
    super(message);
  }
}

// The API's own parser options, so a file reads the same way here as it does there.
const flatParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: false,
  parseTagValue: false,
  allowBooleanAttributes: false,
  processEntities: false,
});

// Ordered parse keeps the whitespace text nodes between spans, which is what
// decides where one word ends and the next begins.
const orderedParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  trimValues: false,
  parseTagValue: false,
  processEntities: false,
  preserveOrder: true,
});

const NAMED_ENTITIES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };

/** Decodes XML entities with the same rules the API applies to lyric text. */
export function decodeEntities(str: string): string {
  if (str.indexOf("&") === -1) return str;
  return str.replace(
    /&(?:#x([0-9a-fA-F]{1,6})|#([0-9]{1,7})|([a-zA-Z][a-zA-Z0-9]{0,31}));/g,
    (match, hex, dec, name) => {
      if (name !== undefined) {
        return Object.prototype.hasOwnProperty.call(NAMED_ENTITIES, name) ? NAMED_ENTITIES[name] : match;
      }
      const code = hex !== undefined ? parseInt(hex, 16) : parseInt(dec, 10);
      if (!Number.isFinite(code) || code <= 0 || code > 0x10ffff) return match;
      if (code >= 0xd800 && code <= 0xdfff) return match;
      if (code === 0x09 || code === 0x0a || code === 0x0d) return String.fromCodePoint(code);
      if (code < 0x20) return match;
      return String.fromCodePoint(code);
    }
  );
}

// Clock (hh:mm:ss.fff, mm:ss.fff), bare seconds, or an s/ms offset: the forms
// the API converts correctly. Anything else it misreads or drops.
const CLOCK_TIME = /^(?:(\d+):)?(?:(\d+):)?(\d+(?:\.\d+)?)$/;
const OFFSET_TIME = /^(\d+(?:\.\d+)?)(ms|s)$/;

/** Seconds for a timestamp the API reads correctly, or null. */
export function parseTime(value: string | undefined): number | null {
  if (value == null) return null;
  const v = value.trim();
  const offset = OFFSET_TIME.exec(v);
  if (offset) return offset[2] === "ms" ? Number(offset[1]) / 1000 : Number(offset[1]);
  const clock = CLOCK_TIME.exec(v);
  if (!clock) return null;
  const parts = [clock[1], clock[2], clock[3]].filter((p) => p !== undefined).map(Number);
  return parts.reduce((total, part) => total * 60 + part, 0);
}

export function formatTime(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "--:--.---";
  // Rounded to milliseconds before splitting, so 59.9996 reads 01:00.000, not 00:60.000.
  const ms = Math.round(seconds * 1000);
  const m = Math.floor(ms / 60_000);
  const s = (ms - m * 60_000) / 1000;
  return `${String(m).padStart(2, "0")}:${s.toFixed(3).padStart(6, "0")}`;
}

// ---------------------------------------------------------------- ordered tree

type OrderedNode = Record<string, any>;

function tagOf(node: OrderedNode): string | undefined {
  return Object.keys(node).find((k) => k !== ":@");
}

function localName(tag: string): string {
  const i = tag.indexOf(":");
  return i === -1 ? tag : tag.slice(i + 1);
}

function attrsOf(node: OrderedNode): Record<string, string> {
  return (node[":@"] as Record<string, string>) ?? {};
}

function childrenOf(node: OrderedNode): OrderedNode[] {
  const tag = tagOf(node);
  if (!tag || tag === "#text") return [];
  const kids = node[tag];
  return Array.isArray(kids) ? kids : [];
}

function isText(node: OrderedNode): boolean {
  return tagOf(node) === "#text";
}

function textOf(node: OrderedNode): string {
  const v = node["#text"];
  return v == null ? "" : String(v);
}

/** All text inside a node, nested elements included. */
function deepText(node: OrderedNode): string {
  if (isText(node)) return textOf(node);
  return childrenOf(node).map(deepText).join("");
}

/** Text nodes that are direct children of a node. */
function directText(node: OrderedNode): string {
  return childrenOf(node)
    .filter(isText)
    .map(textOf)
    .join("");
}

function* walk(nodes: OrderedNode[]): Generator<OrderedNode> {
  for (const node of nodes) {
    if (isText(node)) continue;
    yield node;
    yield* walk(childrenOf(node));
  }
}

function findAll(nodes: OrderedNode[], name: string): OrderedNode[] {
  const out: OrderedNode[] = [];
  for (const node of walk(nodes)) {
    const tag = tagOf(node);
    if (tag && localName(tag) === name) out.push(node);
  }
  return out;
}

function isSpan(node: OrderedNode): boolean {
  return tagOf(node) === "span";
}

// ---------------------------------------------------------------- word glue

/**
 * Index of the first `begin="X" end="Y"` occurrence for each pair. The API
 * decides whether two syllables touch by finding this exact marker in the raw
 * XML, so a span written any other way (end first, single quotes, extra
 * spacing) or sharing its pair with an earlier span is looked up wrongly.
 */
function buildMarkerIndex(xml: string): Map<string, number> {
  const first = new Map<string, number>();
  const re = /begin="([^"]*)" end="([^"]*)"/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml)) !== null) {
    const key = `${m[1]}\0${m[2]}`;
    if (!first.has(key)) first.set(key, m.index);
  }
  return first;
}

interface SpanInfo {
  node: OrderedNode;
  role?: string;
  text: string;
  begin?: string;
  end?: string;
  /** Text node sitting between this span and the next sibling span, if any. */
  textAfter: string;
}

function spanSequence(container: OrderedNode): SpanInfo[] {
  const kids = childrenOf(container);
  const spans: SpanInfo[] = [];
  for (let i = 0; i < kids.length; i++) {
    const node = kids[i];
    if (!isSpan(node)) continue;
    let textAfter = "";
    for (let j = i + 1; j < kids.length && isText(kids[j]); j++) textAfter += textOf(kids[j]);
    const a = attrsOf(node);
    spans.push({ node, role: a["ttm:role"], text: directText(node), begin: a.begin, end: a.end, textAfter });
  }
  return spans;
}

/**
 * Builds syllables for a run of spans, glued the way the API glues them.
 * `apiSpans` is the list the API indexes into when it looks at "the next span":
 * for a lead line that is every span in the <p>, role spans included; for a
 * background vocal it is only the vocal spans.
 */
function buildSyllables(
  vocal: SpanInfo[],
  apiSpans: SpanInfo[],
  raw: string,
  markers: () => Map<string, number>,
  bg: boolean
): Syllable[] {
  const out: Syllable[] = [];
  const apiIndex = new Map(apiSpans.map((s, i) => [s, i]));
  for (const [vi, span] of vocal.entries()) {
    // The API skips spans with no text at all.
    if (span.text === "") continue;
    const at = apiIndex.get(span) ?? -1;
    const next = at >= 0 ? apiSpans[at + 1] : undefined;
    let glued = false;
    let adjacent = false;
    let markerFound = false;
    if (next) {
      const markerAt = markers().get(`${span.begin}\0${span.end}`) ?? -1;
      markerFound = markerAt !== -1;
      if (markerAt !== -1) {
        const close = raw.indexOf("</span>", markerAt);
        if (close !== -1) {
          const after = close + "</span>".length;
          adjacent = raw.length > after && raw.charAt(after) === "<";
        }
      }
      glued =
        adjacent &&
        !/^\s/.test(next.text) &&
        !span.text.trim().endsWith(",") &&
        !/\s$/.test(span.text);
    }

    const syllable: Syllable = {
      text: decodeEntities(span.text),
      rawBegin: span.begin,
      rawEnd: span.end,
      begin: parseTime(span.begin),
      end: parseTime(span.end),
      glued,
      gluedInMarkup: false,
      bg,
    };

    // What the markup itself says, for the pair of vocal syllables only.
    const vocalNext = vocal[vi + 1];
    if (next && next === vocalNext) {
      syllable.gluedInMarkup =
        span.textAfter === "" &&
        !/\s$/.test(span.text) &&
        !/^\s/.test(next.text) &&
        !syllable.text.trim().endsWith(",");
      if (syllable.gluedInMarkup !== glued) {
        syllable.glueMismatch = !markerFound
          ? `its timing isn't written as \`begin="…" end="…"\` (in that order, double quotes, one space)`
          : `another span earlier in the file has the same begin/end pair, so the wrong span is looked at`;
      }
    } else {
      syllable.gluedInMarkup = glued;
    }
    out.push(syllable);
  }
  return out;
}

// ---------------------------------------------------------------- API gate

function asArray<T>(v: T | T[] | undefined | null): T[] {
  return v == null ? [] : Array.isArray(v) ? v : [v];
}

/** How the API infers a mode when the root carries no itunes:timing. */
function inferMode(flat: any): LyricsMode {
  let sawTiming = false;
  for (const div of asArray(flat?.tt?.body?.div)) {
    if (!div || div.p == null) continue;
    for (const p of asArray(div.p)) {
      if (!p || typeof p !== "object") continue;
      if (p.span) {
        const timed = asArray(p.span).filter((s: any) => s && typeof s === "object" && !s["ttm:role"] && s.begin);
        if (timed.length > 1) return "Syllable";
        if (timed.length === 1) sawTiming = true;
      }
      if (p.begin) sawTiming = true;
    }
  }
  return sawTiming ? "Line" : "Static";
}

/**
 * Parses a TTML into the model the checks run on. Throws TtmlParseError for
 * anything that stops the file from being read at all.
 */
export function parseTtml(raw: string): TtmlDocument {
  if (raw.length > MAX_TTML_CHARS) {
    throw new TtmlParseError(
      "file-too-large",
      `File is ${Math.round(raw.length / 1024)} KB; Spicy Lyrics only reads TTMLs up to ${MAX_TTML_CHARS / 1024} KB.`
    );
  }
  if (/<!DOCTYPE|<!ENTITY/i.test(raw)) {
    throw new TtmlParseError("doctype", "File declares a DOCTYPE or ENTITY. TTML exports never do; remove it.");
  }
  // The API's parser is lenient, so broken XML it can still read is reported
  // rather than rejected; the parse below decides whether it loads.
  const valid = XMLValidator.validate(raw, { allowBooleanAttributes: false });
  const xmlProblem = valid === true ? undefined : { message: valid.err.msg, line: valid.err.line };

  let flat: any;
  let ordered: OrderedNode[];
  try {
    flat = flatParser.parse(raw);
    ordered = orderedParser.parse(raw);
  } catch (err) {
    throw new TtmlParseError("xml-malformed", `Broken XML: ${xmlProblem?.message ?? (err as Error).message}`, xmlProblem?.line);
  }

  const tt = flat?.tt;
  if (!tt || typeof tt !== "object") throw new TtmlParseError("no-tt-root", "Root element isn't <tt>, so this isn't a TTML file.");
  if (!tt.body) throw new TtmlParseError("no-body", "File has no <body>, so there are no lyrics to load.");
  if (tt.body.div == null) throw new TtmlParseError("no-body", "<body> has no <div>, so there are no lyrics to load.");

  const timingAttr: string | undefined = tt["itunes:timing"];
  let mode: LyricsMode;
  let modeInferred = false;
  if (timingAttr === "None") mode = "Static";
  else if (timingAttr === "Word") mode = "Syllable";
  else if (timingAttr === "Line") mode = "Line";
  else if (timingAttr === undefined) {
    mode = inferMode(flat);
    modeInferred = true;
  } else {
    throw new TtmlParseError(
      "timing-attr-invalid",
      `itunes:timing="${timingAttr}" isn't something Spicy Lyrics understands. Use "Word", "Line" or "None" (case matters).`
    );
  }

  const ttNode = ordered.find((n) => tagOf(n) === "tt")!;
  const ttKids = childrenOf(ttNode);
  const head = ttKids.find((n) => tagOf(n) === "head");
  const body = ttKids.find((n) => tagOf(n) === "body")!;

  const agents = new Map<string, string | undefined>();
  const songwriters: string[] = [];
  const meta = new Map<string, string>();
  const transliterations: TransliterationEntry[] = [];
  const translationKeys: string[] = [];
  if (head) {
    for (const a of findAll([head], "agent")) {
      const at = attrsOf(a);
      if (at["xml:id"]) agents.set(at["xml:id"], at.type);
    }
    for (const sw of findAll([head], "songwriter")) songwriters.push(decodeEntities(deepText(sw)));
    for (const m of findAll([head], "meta")) {
      const at = attrsOf(m);
      if (at.key && at.value !== undefined) meta.set(at.key, decodeEntities(at.value));
    }
    for (const block of findAll([head], "transliteration")) {
      for (const t of childrenOf(block).filter((n) => tagOf(n) === "text")) {
        let emptySpans = 0;
        for (const s of findAll([t], "span")) {
          if (!attrsOf(s)["ttm:role"] && findAll(childrenOf(s), "span").length === 0 && deepText(s).trim() === "") {
            emptySpans++;
          }
        }
        transliterations.push({ for: attrsOf(t).for, emptySpans });
      }
    }
    for (const block of findAll([head], "translation")) {
      for (const t of childrenOf(block).filter((n) => tagOf(n) === "text")) {
        const key = attrsOf(t).for;
        if (key) translationKeys.push(key);
      }
    }
  }

  let markerIndex: Map<string, number> | undefined;
  const markers = () => (markerIndex ??= buildMarkerIndex(raw));

  const bodyAgent = attrsOf(body)["ttm:agent"];
  const lines: Line[] = [];
  const droppedLines: Line[] = [];
  let n = 0;
  for (const div of childrenOf(body).filter((d) => tagOf(d) === "div")) {
    const divAttrs = attrsOf(div);
    const songPart = divAttrs["itunes:songPart"];
    const dropped = songPart === "Instrumental" || (mode === "Static" && songPart === "Outro");
    for (const p of childrenOf(div).filter((x) => tagOf(x) === "p")) {
      const pa = attrsOf(p);
      const spans = spanSequence(p);
      const vocal = spans.filter((s) => !s.role);
      const line: Line = {
        n: ++n,
        rawBegin: pa.begin,
        rawEnd: pa.end,
        begin: parseTime(pa.begin),
        end: parseTime(pa.end),
        agent: pa["ttm:agent"] || divAttrs["ttm:agent"] || bodyAgent,
        key: pa["itunes:key"],
        songPart,
        lead: buildSyllables(vocal, spans, raw, markers, false),
        backgrounds: [],
        directText: decodeEntities(directText(p)),
        roman: [],
        translation: [],
        unknownRoles: [],
      };
      for (const s of spans) {
        if (s.role === "x-bg") {
          const inner = spanSequence(s.node);
          const innerVocal = inner.filter((x) => !x.role);
          line.backgrounds.push({
            syllables: buildSyllables(innerVocal, innerVocal, raw, markers, true),
            directText: decodeEntities(directText(s.node)),
            key: attrsOf(s.node)["itunes:key"],
          });
        } else if (s.role === "x-roman") {
          line.roman.push(decodeEntities(deepText(s.node)));
        } else if (s.role === "x-translation") {
          line.translation.push(decodeEntities(deepText(s.node)));
        } else if (s.role) {
          line.unknownRoles.push(s.role);
        }
      }
      (dropped ? droppedLines : lines).push(line);
    }
  }

  return {
    raw,
    xmlProblem,
    lang: attrsOf(ttNode)["xml:lang"],
    timingAttr,
    mode,
    modeInferred,
    lines,
    droppedLines,
    agents,
    songwriters,
    meta,
    bodyDur: parseTime(attrsOf(body).dur),
    transliterations,
    translationKeys,
  };
}

// ---------------------------------------------------------------- rendering

/** A syllable's text as Spicy Lyrics shows it. */
export function shownText(s: Syllable): string {
  const t = s.text.trim();
  return s.bg ? t.replace(/[()]/g, "") : t;
}

/** Groups syllables into the words Spicy Lyrics draws. */
export function wordsOf(syllables: Syllable[]): Syllable[][] {
  const words: Syllable[][] = [];
  let current: Syllable[] = [];
  for (const s of syllables) {
    current.push(s);
    if (!s.glued) {
      words.push(current);
      current = [];
    }
  }
  if (current.length) words.push(current);
  return words;
}

/** The line as it renders: syllables joined, a space wherever a word ends. */
export function renderSyllables(syllables: Syllable[]): string {
  return wordsOf(syllables)
    .map((w) => w.map(shownText).join(""))
    .join(" ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Visible lead text of a line, whatever the mode. */
export function leadText(line: Line, mode: LyricsMode | null): string {
  if (mode === "Syllable") return renderSyllables(line.lead);
  if (line.lead.length) {
    return line.lead
      .map((s) => s.text)
      .reduce((acc, cur, i) => (i === 0 ? cur : acc + (/\s$/.test(acc) || /^\s/.test(cur) ? "" : " ") + cur), "")
      .replace(/\s+/g, " ")
      .trim();
  }
  return line.directText.replace(/\s+/g, " ").trim();
}

export function backgroundText(bg: Background): string {
  if (bg.syllables.length) return renderSyllables(bg.syllables);
  return bg.directText.replace(/[()]/g, "").replace(/\s+/g, " ").trim();
}
