"""Turns CMUdict pronunciations into sung-syllable splits.

The pronunciation gives the number of syllables (one per vowel sound); the
spelling decides where the cut goes. For each word:

1. Count syllables from every pronunciation CMUdict lists. The shortest is the
   default (`every(2)` = EV-REE), and an unstressed IY/IH/UW followed by an
   unstressed vowel is one sung syllable (`serious` = SE-RIOUS, `radio` =
   RA-DIO). The longest count, when different, becomes an alternative.
2. Match vowel sounds to vowel-letter groups, allowing silent groups (final
   `e`, `-ed` after anything but t/d) and groups carrying two sounds (`i/o` in
   `lion`).
3. Cut each consonant cluster between two syllables so the second syllable
   starts with the longest onset English allows, keeping ch/sh/th/ph/gh/ck/wh/qu
   together (`ma/king`, `hun/dred`, `fi/ckle`, `sin/ging`).

Usage: python cmu_splits.py <cmudict.dict> <out.jsonl> [common words: corpus
words.jsonl and/or a JSON dict of words, for compound seams]
CMUdict is BSD-licensed (Carnegie Mellon University); keep its LICENSE with
anything built from it.
"""

import json
import re
import sys
from collections import defaultdict

DIGRAPHS = {"ch", "sh", "th", "ph", "gh", "ck", "wh", "qu"}
# Onsets a syllable may start with in the middle of a word. No s-clusters:
# TX24 puts the s with the syllable before (mis/ter, res/ponse, es/cape).
ONSETS = set(
    """b c d f g h j k l m n p r s t v w x y z ch sh th ph wh qu bl br cl cr dr fl fr gl gr pl
    pr tr tw wr kn shr thr""".split()
)
# Vowel pairs that are one sound, so a group carrying two syllables splits
# after them (see/ing), not inside them.
VOWEL_DIGRAPHS = {"ee", "oo", "ea", "ai", "ay", "oa", "ou", "ey", "oy", "aw", "ew", "ow", "au", "ei", "oi"}
SUFFIXES = {"ness", "ment", "ments", "less", "ful", "ly", "ship", "hood", "dom", "ward", "wards"}
PREFIXES = {"mis", "dis", "un", "out", "over", "under"}
GLIDE_FIRST = {"IY", "IH", "UW"}
# Common words for spotting compound seams (dark/ness, good/bye): lyric words
# and the frequency dictionary, not all of CMUdict, which lists fragments
# like "ing" and "ers" as words.
WORDS = set()


def nuclei(phones):
    """Vowel sounds as (phone, stress)."""
    return [(p[:-1], p[-1]) for p in phones if p[-1].isdigit()]


def sung_count(phones):
    """Syllables as sung: unstressed IY/IH/UW + unstressed vowel glide into one."""
    vs = nuclei(phones)
    count = len(vs)
    k = 0
    while k < len(vs) - 1:
        (a, sa), (b, sb) = vs[k], vs[k + 1]
        if a in GLIDE_FIRST and sa == "0" and sb in "02" and k + 1 == len(vs) - 1 or (
            a in GLIDE_FIRST and sa == "0" and sb == "0"
        ):
            count -= 1
            k += 2
        else:
            k += 1
    return max(count, 1)


def is_vowel_at(word, k):
    """Whether word[k] is a vowel letter here. `u` after q (and after g before a
    vowel, as in guard) is a consonant; `y` is a consonant at the start and
    between two vowels (player), a vowel elsewhere (dying, day)."""
    c = word[k]
    prev = word[k - 1] if k > 0 else ""
    nxt = word[k + 1] if k + 1 < len(word) else ""
    if c in "aeio":
        return True
    if c == "u":
        return not (prev == "q" or (prev == "g" and nxt in "aeiouy" and nxt != ""))
    if c == "y":
        if k == 0:
            return False
        if prev in "aeiou" and nxt in "aeiou" and nxt != "":
            return False
        return True
    return False


def vowel_groups(word):
    """Spans of consecutive vowel letters."""
    groups = []
    k = 0
    while k < len(word):
        if is_vowel_at(word, k):
            start = k
            while k < len(word) and is_vowel_at(word, k):
                k += 1
            groups.append((start, k))
        else:
            k += 1
    return groups


def silent_cost(word, group, index, total):
    """Cost of a vowel group being silent (carrying no syllable)."""
    start, end = group
    text = word[start:end]
    last = index == total - 1
    tail = word[end:]
    before = word[max(0, start - 2) : start]
    if text == "e" and start > 0 and not is_vowel_at(word, start - 1):
        if last and tail in ("", "s", "d") and word[start - 1] == "l" and start >= 2 and not is_vowel_at(word, start - 2):
            return 9  # a final -le after a consonant is sung: cou/ple, lit/tle
        if last and tail == "s" and (before[-1:] in ("s", "x", "z", "c", "g") or before in ("ch", "sh")):
            return 9  # -es after a hissing sound is sung: horses, places
        if last and tail == "d" and before[-1:] in ("t", "d"):
            return 9  # -ted / -ded is sung
        if last and tail in ("", "s", "d"):
            return 0.2
        if any(tail.startswith(s) for s in SUFFIXES):
            return 0.3  # magic e before a suffix: complete/ly, forgive/ness
        if not last and len(word[:end]) >= 4 and word[:end] in WORDS:
            return 0.5  # the e closes a word inside a compound: some/one
    return 6


def assign(word, count):
    """How many syllables each vowel group carries, summing to `count`."""
    groups = vowel_groups(word)
    if not groups:
        return groups, []
    inf = float("inf")
    # best[i][j]: cost of the first i groups carrying j syllables.
    best = [[inf] * (count + 1) for _ in range(len(groups) + 1)]
    back = [[None] * (count + 1) for _ in range(len(groups) + 1)]
    best[0][0] = 0
    for i, group in enumerate(groups):
        length = group[1] - group[0]
        silent = silent_cost(word, group, i, len(groups))
        text = word[group[0] : group[1]]
        # -tion, -sion, -cial: the i is not a syllable of its own.
        soft_i = text.startswith("i") and group[0] > 0 and word[group[0] - 1] in "tscx"
        for j in range(count + 1):
            if best[i][j] == inf:
                continue
            for take, cost in (
                (0, silent),
                # A group that is usually silent should rather stay silent.
                (1, 2.5 if silent < 1 else 0),
                (2, 8 if length < 2 or soft_i else 1.5),
            ):
                if j + take <= count and best[i][j] + cost < best[i + 1][j + take]:
                    best[i + 1][j + take] = best[i][j] + cost
                    back[i + 1][j + take] = take
    if best[len(groups)][count] == inf:
        return groups, None
    takes = []
    j = count
    for i in range(len(groups), 0, -1):
        take = back[i][j]
        takes.append(take)
        j -= take
    return groups, takes[::-1]


SHORT_HEADS = {"out", "any", "sun", "day", "new", "off", "car", "eye", "air"}
VOWEL_TAILS = {"one", "out", "ever", "all", "any", "end", "in", "on", "up", "ear", "eye", "age"}


def seam(word, start, end):
    """A cut between word[start:end] at a compound seam or after a prefix
    (dark/ness, down/stairs, mis/understood), if there is one. The first half
    is a real word of 4+ letters (or a common short head like out); the second
    starts with a consonant unless it's a word like one or ever, so pack/age
    and rep/eat don't count."""
    for k in range(start, end + 1):
        left, right = word[:k], word[k:]
        if left in PREFIXES and len(right) >= 4 and right in WORDS:
            return k
        if not (len(left) >= 4 or left in SHORT_HEADS) or left not in WORDS:
            continue
        if right[:1] in "aeiouy" and right not in VOWEL_TAILS:
            continue
        if right in SUFFIXES or (len(right) >= 3 and right in WORDS):
            return k
    return None


def onset_cut(word, start, end):
    """Cut inside the consonants word[start:end]: at a compound seam if there
    is one, else so the next syllable gets the longest allowed onset, never
    splitting a digraph."""
    at_seam = seam(word, start, end)
    if at_seam is not None:
        return at_seam
    cluster = word[start:end]
    if not cluster:
        return start
    for k in range(len(cluster)):
        onset = cluster[k:]
        if onset.replace("'", "") in ONSETS or onset == "":
            if k > 0 and cluster[k - 1 : k + 1] in DIGRAPHS:
                continue
            return start + k
    return end - 1 if cluster[-2:] not in DIGRAPHS else end - 2


def split_word(word, count):
    groups, takes = assign(word, count)
    if takes is None:
        return None
    # Vowel spans that start a syllable, in order.
    spans = []
    for (start, end), take in zip(groups, takes):
        if take == 1:
            spans.append((start, end))
        elif take == 2:
            mid = start + 2 if word[start : start + 2] in VOWEL_DIGRAPHS and end - start > 2 else start + 1
            spans.append((start, mid))
            spans.append((mid, end))
        elif spans:
            # A silent group joins the syllable before it.
            spans[-1] = (spans[-1][0], end)
    cuts = []
    for (a_start, a_end), (b_start, b_end) in zip(spans, spans[1:]):
        if a_end == b_start:
            cuts.append(b_start)  # two sounds in one vowel group: li/on
        elif re.fullmatch(r"le[sd]?", word[b_start - 1 :]) and b_start - a_end >= 2:
            # A final -le syllable takes the consonant before the l with it:
            # lit/tle, whis/tle, fi/ckle.
            k = b_start - 2
            if word[k - 1 : k + 1] in DIGRAPHS:
                k -= 1
            cuts.append(max(k, a_end))
        else:
            cuts.append(onset_cut(word, a_end, b_start))
    pieces = []
    last = 0
    for c in cuts:
        pieces.append(word[last:c])
        last = c
    pieces.append(word[last:])
    if any(p == "" for p in pieces):
        return None
    return "/".join(pieces)


def main(dict_path, out_path, *common_paths):
    prons = defaultdict(list)
    for line in open(dict_path, encoding="utf8"):
        line = line.split("#")[0].strip()
        if not line:
            continue
        head, *phones = line.split()
        word = re.sub(r"\(\d+\)$", "", head)
        if re.fullmatch(r"[a-z']+", word) and re.search(r"[a-z]", word):
            prons[word].append(phones)
    # CMUdict's longer entries are real words; its short ones include fragments.
    WORDS.update(w for w in prons if len(w) >= 5 and "'" not in w)
    for path in common_paths:
        if path.endswith(".jsonl"):
            for line in open(path, encoding="utf8"):
                token = re.sub(r"^[^a-z']+|[^a-z']+$", "", json.loads(line)["word"].lower())
                if len(token) >= 3:
                    WORDS.add(token)
        else:
            WORDS.update(k for k in json.load(open(path, encoding="utf8")) if len(k) >= 3)
    written = 0
    failed = 0
    with open(out_path, "w", encoding="utf8") as out:
        for word, variants in prons.items():
            counts = sorted({sung_count(p) for p in variants} | {len(nuclei(p)) for p in variants})
            default = min(sung_count(p) for p in variants)
            # Spoken n't often loses its vowel; sung, it's its own syllable.
            if word.endswith("n't"):
                default = max(sung_count(p) for p in variants)
            split = split_word(word, default)
            if split is None:
                failed += 1
                continue
            alternatives = []
            for c in counts:
                if c != default:
                    alt = split_word(word, c)
                    if alt and alt != split:
                        alternatives.append(alt)
            out.write(json.dumps({"word": word, "split": split, "alternatives": alternatives}) + "\n")
            written += 1
    print(f"{written} words, {failed} could not be matched to their spelling")


if __name__ == "__main__":
    main(*sys.argv[1:])
