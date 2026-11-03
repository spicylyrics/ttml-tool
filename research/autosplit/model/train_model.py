"""Trains a character BiLSTM that gives a cut probability for every gap in a
word, and scores it on TX24's votes with 5-fold cross-validation (test words
are left out of all training data, so it is judged on words it never saw).

Training data, by weight:
- CMUdict-derived splits (cmu_splits.py): default cuts 1.0, cuts only in an
  alternative 0.35.
- Claude's hand-made list (data/claude-splits.json): cuts 1.0.
- TX24's votes in the other folds, weight 4: pick cuts 1.0, cuts only in a
  ticked or typed split 0.5.

Usage:
python train_model.py <cmu-splits.jsonl> <claude-splits.json> <votes.jsonl> <rules-on-votes.json> <out dir>
"""

import json
import random
import re
import sys
import zlib
from pathlib import Path

import torch
from torch import nn

DEVICE = "cuda" if torch.cuda.is_available() else "cpu"
VOWELS = set("aeiouyàâäéèêëïîôöùûü")
EPOCHS = 6
BATCH = 512


def cuts_of(split):
    cuts, offset = [], 0
    for part in split.split("/")[:-1]:
        offset += len(part)
        cuts.append(offset)
    return cuts


def split_at(word, cuts):
    out, last = [], 0
    for c in sorted(cuts):
        out.append(word[last:c])
        last = c
    out.append(word[last:])
    return "/".join(out)


def targets(word, sure, maybe=()):
    sure, maybe = set(sure), set(maybe) - set(sure)
    return [1.0 if g in sure else 0.35 if g in maybe else 0.0 for g in range(1, len(word))]


def fold_of(word):
    return zlib.crc32(word.encode("utf8")) % 5


def rule_only(word):
    """Acronyms, digits and symbols stay with the rules."""
    return bool(re.fullmatch(r"[A-Z]{2,4}", word) or re.search(r"[0-9$&]", word))


class Splitter(nn.Module):
    def __init__(self, vocab_size, embed=48, hidden=128):
        super().__init__()
        self.embed = nn.Embedding(vocab_size, embed, padding_idx=0)
        self.lstm = nn.LSTM(embed, hidden, num_layers=2, bidirectional=True, batch_first=True, dropout=0.2)
        self.head = nn.Sequential(nn.Linear(4 * hidden, hidden), nn.ReLU(), nn.Linear(hidden, 1))

    def forward(self, ids):
        # ids: [batch, length + 2] with BOS and EOS; gap g sits between chars g and g+1.
        h, _ = self.lstm(self.embed(ids))
        left = h[:, 1:-2]
        right = h[:, 2:-1]
        return self.head(torch.cat([left, right], dim=-1)).squeeze(-1)


class Vocab:
    def __init__(self, words):
        chars = sorted({c for w in words for c in w})
        self.index = {c: k + 4 for k, c in enumerate(chars)}  # 0 pad, 1 BOS, 2 EOS, 3 unknown

    def encode(self, word):
        return [1] + [self.index.get(c, 3) for c in word] + [2]


def batches(examples, vocab, shuffle):
    order = list(range(len(examples)))
    if shuffle:
        random.shuffle(order)
    for start in range(0, len(order), BATCH):
        chunk = [examples[k] for k in order[start : start + BATCH]]
        width = max(len(w) for w, _, _ in chunk) + 2
        ids = torch.zeros(len(chunk), width, dtype=torch.long)
        target = torch.zeros(len(chunk), width - 3)
        mask = torch.zeros(len(chunk), width - 3)
        weight = torch.zeros(len(chunk), 1)
        for row, (word, t, w) in enumerate(chunk):
            enc = vocab.encode(word)
            ids[row, : len(enc)] = torch.tensor(enc)
            target[row, : len(t)] = torch.tensor(t)
            mask[row, : len(t)] = 1
            weight[row, 0] = w
        yield ids.to(DEVICE), target.to(DEVICE), mask.to(DEVICE), weight.to(DEVICE)


def train(examples, vocab):
    model = Splitter(len(vocab.index) + 4).to(DEVICE)
    opt = torch.optim.Adam(model.parameters(), lr=2e-3)
    loss_fn = nn.BCEWithLogitsLoss(reduction="none")
    for epoch in range(EPOCHS):
        model.train()
        for ids, target, mask, weight in batches(examples, vocab, shuffle=True):
            logits = model(ids)[:, : target.shape[1]]
            loss = (loss_fn(logits, target) * mask * weight).sum() / (mask * weight).sum()
            opt.zero_grad()
            loss.backward()
            opt.step()
        for group in opt.param_groups:
            group["lr"] *= 0.7
    model.eval()
    return model


@torch.no_grad()
def probabilities(model, vocab, word):
    ids = torch.tensor([vocab.encode(word)], device=DEVICE)
    return torch.sigmoid(model(ids)[0, : len(word) - 1]).tolist()


def predict(model, vocab, word):
    lower = word.lower()
    probs = probabilities(model, vocab, lower)
    cuts = [g + 1 for g, p in enumerate(probs) if p > 0.5]

    def vowelless():
        return any(not (set(piece) & VOWELS) for piece in split_at(lower, cuts).split("/"))

    while cuts and vowelless():
        cuts.remove(min(cuts, key=lambda c: probs[c - 1]))
    return split_at(word, cuts), probs


def main(cmu_path, claude_path, votes_path, rules_path, out_dir):
    random.seed(1)
    torch.manual_seed(1)
    out = Path(out_dir)
    out.mkdir(parents=True, exist_ok=True)
    cmu = [json.loads(line) for line in open(cmu_path, encoding="utf8")]
    claude = json.load(open(claude_path, encoding="utf8"))["words"]
    votes = [json.loads(line) for line in open(votes_path, encoding="utf8")]
    votes = [v for v in votes if not v["skipped"] and v["pick"]]
    rules = json.load(open(rules_path, encoding="utf8"))
    cmu_by_word = {e["word"]: e for e in cmu}

    def source_examples(skip):
        ex = []
        for e in cmu:
            if e["word"] in skip or len(e["word"]) < 2:
                continue
            alt = {c for a in e["alternatives"] for c in cuts_of(a)}
            ex.append((e["word"], targets(e["word"], cuts_of(e["split"]), alt), 1.0))
        for e in claude:
            w = e["word"].lower()
            if w in skip or len(w) < 2 or rule_only(e["word"]):
                continue
            ex.append((w, targets(w, cuts_of(e["split"].lower())), 2.0))
        for v in votes:
            w = v["word"].lower()
            if w in skip or len(w) < 2 or rule_only(v["word"]):
                continue
            others = {c for s in [*v["ticked"], v["custom"]] if s for c in cuts_of(s.lower())}
            t = [0.5 if (g in others and t == 0) else t for g, t in zip(range(1, len(w)), targets(w, cuts_of(v["pick"].lower())))]
            ex.append((w, t, 4.0))
        return ex

    all_words = {e["word"] for e in cmu} | {e["word"].lower() for e in claude} | {v["word"].lower() for v in votes}
    vocab = Vocab(all_words)
    systems = ("rules", "cmu list", "model", "cmu list, else model")
    groups = ("in cmu list", "not in cmu list")
    tally = {(s, g): [0, 0, 0] for s in systems for g in groups}  # n, acceptable, exact
    band = {"flagged": [0, 0], "clear": [0, 0]}  # n, wrong
    misses = []
    for fold in range(5):
        test = [v for v in votes if fold_of(v["word"].lower()) == fold]
        skip = {v["word"].lower() for v in test}
        model = train(source_examples(skip), vocab)
        for v in test:
            word, lower = v["word"], v["word"].lower()
            right = {s.lower() for s in [*v["ticked"], v["pick"], v["custom"]] if s}
            pick = v["pick"].lower()
            r = rules.get(word, word).lower()
            if rule_only(word):
                m, probs = r, []
            else:
                m, probs = predict(model, vocab, word)
                m = m.lower()
            in_cmu = lower in cmu_by_word
            c = cmu_by_word[lower]["split"] if in_cmu else r
            g = groups[0] if in_cmu else groups[1]
            for name, s in (("rules", r), ("cmu list", c), ("model", m), ("cmu list, else model", c if in_cmu else m)):
                t = tally[(name, g)]
                t[0] += 1
                t[1] += s in right
                t[2] += s == pick
            if probs:
                key = "flagged" if any(0.35 <= p <= 0.65 for p in probs) else "clear"
                band[key][0] += 1
                band[key][1] += m not in right
            if m not in right:
                misses.append(f"{lower}: model {m}, rules {r}, you {pick}")
        print(f"fold {fold + 1}/5 done", flush=True)

    lines = ["# Character BiLSTM vs rules on TX24's votes (5-fold, test words unseen)", ""]
    for g in groups:
        lines += [f"## {g}", "", "| | words | acceptable | exact (your pick) |", "|---|---|---|---|"]
        for s in systems:
            n, ok, ex = tally[(s, g)]
            lines.append(f"| {s} | {n} | {100 * ok / max(n, 1):.1f}% | {100 * ex / max(n, 1):.1f}% |")
        lines.append("")
    lines.append("## All words")
    lines += ["", "| | words | acceptable | exact (your pick) |", "|---|---|---|---|"]
    for s in systems:
        n = sum(tally[(s, g)][0] for g in groups)
        ok = sum(tally[(s, g)][1] for g in groups)
        ex = sum(tally[(s, g)][2] for g in groups)
        lines.append(f"| {s} | {n} | {100 * ok / n:.1f}% | {100 * ex / n:.1f}% |")
    fn, fw = band["flagged"]
    cn, cw = band["clear"]
    lines += [
        "",
        f"Unsure band (a cut 35-65% sure): {100 * fn / max(fn + cn, 1):.1f}% of words flagged; wrong {100 * fw / max(fn, 1):.1f}% when flagged, {100 * cw / max(cn, 1):.1f}% otherwise.",
        "",
        f"## Model misses ({len(misses)})",
        "",
        *[f"- {m}" for m in sorted(misses)],
    ]
    (out / "report.md").write_text("\n".join(lines), encoding="utf8")
    print("\n".join(lines[: 40]))

    # The model to keep: trained on everything.
    final = train(source_examples(set()), vocab)
    torch.save(final.state_dict(), out / "model.pt")
    (out / "vocab.json").write_text(json.dumps(vocab.index), encoding="utf8")
    print("saved", out / "model.pt")


if __name__ == "__main__":
    main(*sys.argv[1:])
