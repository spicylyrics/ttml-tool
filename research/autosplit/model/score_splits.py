"""Scores a split list (JSON lines: word, split, alternatives) against TX24's
votes: does the default count match, is the default one TX24 marked right, is
any of the list's splits marked right.

Usage: python score_splits.py <splits.jsonl> <votes.jsonl>
"""

import json
import sys
from collections import Counter


def main(splits_path, votes_path):
    splits = {}
    for line in open(splits_path, encoding="utf8"):
        entry = json.loads(line)
        splits[entry["word"]] = entry
    total = Counter()
    misses = []
    for line in open(votes_path, encoding="utf8"):
        vote = json.loads(line)
        if vote["skipped"] or not vote["pick"]:
            continue
        word = vote["word"].lower()
        entry = splits.get(word)
        if not entry:
            total["not in list"] += 1
            continue
        right = {s.lower() for s in [*vote["ticked"], vote["pick"], vote["custom"]] if s}
        pick = vote["pick"].lower()
        total["words"] += 1
        default = entry["split"]
        if default.count("/") == pick.count("/"):
            total["same count as your pick"] += 1
        if default in right:
            total["default marked right"] += 1
        elif any(a in right for a in entry["alternatives"]):
            total["an alternative marked right"] += 1
        else:
            misses.append(f"{word}: list {default} {entry['alternatives']}, you {pick}")
        if default == pick:
            total["default is your pick"] += 1
    n = total["words"]
    print(f"{n} voted words in the list ({total['not in list']} not in it)")
    for key in ("default is your pick", "default marked right", "an alternative marked right", "same count as your pick"):
        print(f"  {key}: {total[key]} ({100 * total[key] / n:.1f}%)")
    print(f"  wrong (no list split marked right): {len(misses)} ({100 * len(misses) / n:.1f}%)")
    for m in misses[:80]:
        print("   ", m)


if __name__ == "__main__":
    main(sys.argv[1], sys.argv[2])
