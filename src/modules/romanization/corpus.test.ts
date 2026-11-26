// Golden test for on-device romanization over romanization-corpus.json, the
// same corpus Spicy Lyrics checks its own romanizer against, so a file
// romanized here matches what the extension would show. The corpus is copied
// from its own repository; change it there first.
//
// A case with `known.editor` holds this tool's current output where it is
// known to miss the target. The test expects that output instead, and fails
// once the target is reached; then delete the entry.
import kuromoji, { type IpadicFeatures, type Tokenizer } from "kuromoji";
import { describe, expect, it, vi } from "vitest";
import { romanizeLine } from "./fill";
import type { SongLanguage } from "./language";
import corpus from "./romanization-corpus.json";

const tokenizer = new Promise<Tokenizer<IpadicFeatures>>((resolve, reject) =>
	kuromoji
		.builder({ dicPath: "node_modules/kuromoji/dict" })
		.build((error, built) => (error ? reject(error) : resolve(built))),
);

vi.mock("./engines/japanese", async (original) => ({
	...(await original<typeof import("./engines/japanese")>()),
	loadJapaneseTokenizer: () => tokenizer,
}));

type Case = {
	id: string;
	lang: SongLanguage;
	syllables: string[];
	expected: string[];
	known?: Record<string, string[]>;
};

describe("romanization corpus", () => {
	for (const c of corpus.cases as Case[]) {
		it(c.id, { timeout: 30_000 }, async () => {
			expect(await romanizeLine(c.syllables, c.lang)).toEqual(
				c.known?.editor ?? c.expected,
			);
		});
	}
});
