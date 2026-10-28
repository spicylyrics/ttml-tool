export interface RankableItem {
	id: string;
	/** What the row shows. Matched first and weighted highest. */
	label: string;
	/** Extra words that find the item but don't show, e.g. a settings page's keywords. */
	keywords?: string;
}

/** Lowercases and drops accents, so "edicion" finds "Edición". */
export function foldPaletteText(text: string): string {
	return text.normalize("NFD").replace(/\p{M}/gu, "").toLocaleLowerCase();
}

const WORD_BOUNDARY = /[\s\-_/:.(),&]/;

/** Each query character in order, not necessarily adjacent. 0 when not all are found. */
function subsequenceScore(text: string, token: string): number {
	let from = 0;
	let first = -1;
	let last = -1;
	for (const char of token) {
		const index = text.indexOf(char, from);
		if (index === -1) return 0;
		if (first === -1) first = index;
		last = index;
		from = index + 1;
	}
	const span = last - first + 1;
	// Tighter matches score higher: "tmshft" in "time shift" beats one spread over the line.
	return 10 + Math.round((20 * token.length) / span);
}

function tokenScore(label: string, keywords: string, token: string): number {
	if (label.startsWith(token)) return 100;
	let index = label.indexOf(token);
	while (index !== -1) {
		if (WORD_BOUNDARY.test(label[index - 1] ?? " ")) return 80;
		index = label.indexOf(token, index + 1);
	}
	if (label.includes(token)) return 60;
	if (keywords.includes(token)) return 40;
	return subsequenceScore(label, token);
}

/**
 * Score of one item for a query, or 0 when it doesn't match. Every word of
 * the query has to match the label or the keywords; how well each one matches
 * (prefix, word start, anywhere, scattered letters) sets the score.
 */
export function scorePaletteItem(item: RankableItem, query: string): number {
	const tokens = foldPaletteText(query).trim().split(/\s+/).filter(Boolean);
	if (tokens.length === 0) return 0;
	const label = foldPaletteText(item.label);
	const keywords = foldPaletteText(item.keywords ?? "");
	let total = 0;
	for (const token of tokens) {
		const score = tokenScore(label, keywords, token);
		if (score === 0) return 0;
		total += score;
	}
	const whole = tokens.join(" ");
	if (label === whole) total += 50;
	return total;
}

/**
 * Orders items for the palette.
 *
 * Empty query: recent items first (newest first), then everything else in
 * the given order. Otherwise only matches, best first; a recent item gets a
 * small boost so it wins ties, and equal scores keep the given order.
 */
export function rankPaletteItems<T extends RankableItem>(
	items: readonly T[],
	query: string,
	recent: readonly string[] = [],
): T[] {
	const recentRank = new Map(recent.map((id, index) => [id, index]));
	if (query.trim() === "") {
		const recentItems = items
			.filter((item) => recentRank.has(item.id))
			.sort(
				(a, b) => (recentRank.get(a.id) ?? 0) - (recentRank.get(b.id) ?? 0),
			);
		return [
			...recentItems,
			...items.filter((item) => !recentRank.has(item.id)),
		];
	}
	return items
		.map((item, index) => {
			const score = scorePaletteItem(item, query);
			const rank = recentRank.get(item.id);
			const boost = score > 0 && rank !== undefined ? 15 - rank : 0;
			return { item, index, score: score + boost };
		})
		.filter((entry) => entry.score > 0)
		.sort((a, b) => b.score - a.score || a.index - b.index)
		.map((entry) => entry.item);
}
