import { readFileSync } from "node:fs";
import { it } from "vitest";
import { getSyllabificationEngine } from "$/modules/segmentation/utils/syllabification-engines";

it.skipIf(!process.env.AUTOSPLIT_WORDS)("unsure types", () => {
	const rows = readFileSync(process.env.AUTOSPLIT_WORDS as string, "utf8")
		.split("\n")
		.filter(Boolean)
		.map((l) => JSON.parse(l));
	const engine = getSyllabificationEngine("prosodic");
	const counts = new Map<
		string,
		{ n: number; split: string; gold: Map<string, number> }
	>();
	for (const r of rows) {
		const w = r.word.replace(/^[^\p{L}]+|[^\p{L}'’]+$/gu, "").toLowerCase();
		if (!/^[a-z'’]+$/.test(w) || w.length < 3) continue;
		const d = engine.splitDetailed?.(w);
		if (!d?.unsure) continue;
		const c = counts.get(w) ?? {
			n: 0,
			split: d.parts.join("/"),
			gold: new Map(),
		};
		c.n++;
		const g = r.parts
			.join("/")
			.toLowerCase()
			.replace(/[^a-z'’/]/g, "");
		c.gold.set(g, (c.gold.get(g) ?? 0) + 1);
		counts.set(w, c);
	}
	const top = [...counts].sort((a, b) => b[1].n - a[1].n).slice(0, 60);
	console.log(counts.size, "unsure types");
	console.log(
		top
			.map(
				([w, c]) =>
					`${c.n} ${c.split} | ${[...c.gold]
						.sort((a, b) => b[1] - a[1])
						.slice(0, 2)
						.map(([g, n]) => `${g}:${n}`)
						.join(" ")}`,
			)
			.join("\n"),
	);
});
