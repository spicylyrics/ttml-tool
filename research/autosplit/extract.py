"""Extract word-level split observations from synced TTML files.

Output: JSONL rows {file, word, parts, lang} where parts are the span texts
that make up one whitespace-delimited word (len(parts) > 1 means split).
"""
import json, re, sys, os
import xml.etree.ElementTree as ET

TT = "{http://www.w3.org/ns/ttml}"
TTM = "{http://www.w3.org/ns/ttml#metadata}"
XML = "{http://www.w3.org/XML/1998/namespace}"

src, out = sys.argv[1], sys.argv[2]


def words_of(p):
    """Yield lists of span texts per word inside a <p> (or bg span)."""
    cur = []
    def flush():
        nonlocal cur
        if cur:
            yield_list.append(cur)
        cur = []
    yield_list = []
    # Walk direct children in order, tracking whitespace in tails/texts
    def walk(el):
        nonlocal cur
        for ch in el:
            role = ch.get(TTM + "role")
            if role in ("x-roman", "x-translation"):
                if ch.tail and re.search(r"\s", ch.tail):
                    flush()
                continue
            if role == "x-bg":
                flush()
                walk(ch)
                flush()
            elif ch.tag.split("}")[-1] == "span":
                text = "".join(ch.itertext())
                if not text.strip():
                    flush()
                else:
                    lead = text[0].isspace()
                    trail = text[-1].isspace()
                    if lead:
                        flush()
                    inner = text.strip()
                    pieces = inner.split()
                    for i, piece in enumerate(pieces):
                        if i > 0:
                            flush()
                        cur.append(piece)
                    if trail:
                        flush()
            if ch.tail and re.search(r"\s", ch.tail):
                flush()
    walk(p)
    flush()
    return yield_list


n = 0
with open(out, "w", encoding="utf-8") as fo:
    for name in sorted(os.listdir(src)):
        if not name.endswith(".ttml") or ".before-" in name:
            continue
        try:
            root = ET.parse(os.path.join(src, name)).getroot()
        except ET.ParseError as e:
            print("skip", name, e, file=sys.stderr)
            continue
        lang = root.get(XML + "lang") or ""
        for p in (e for e in root.iter() if isinstance(e.tag, str) and e.tag.split("}")[-1] == "p"):
            for parts in words_of(p):
                word = "".join(parts)
                fo.write(json.dumps({"file": name, "word": word, "parts": parts, "lang": lang}, ensure_ascii=False) + "\n")
                n += 1
print(n, "words")
