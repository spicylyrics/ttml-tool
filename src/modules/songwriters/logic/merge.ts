import type { SongwriterSource, SourceResult } from "./types";

export interface FinderRow {
	id: string;
	credited: string;
	legal?: string;
	sources: SongwriterSource[];
	alreadyAdded: boolean;
}

/** Compares names loosely: case, accents and punctuation don't matter. */
export function normalizeName(name: string): string {
	return name
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.toLowerCase()
		.replace(/[^\p{L}\p{N}]+/gu, "");
}

const keysOf = (credited: string, legal?: string) =>
	[credited, legal]
		.filter((name): name is string => !!name?.trim())
		.map(normalizeName);

/**
 * One row per person across all sources. A writer matches an existing row
 * when either their credited or legal name matches either of the row's.
 * MusicBrainz legal names are recorded, Genius ones are guessed from a bio,
 * so MusicBrainz goes first and wins a disagreement.
 */
export function mergeWriters(
	results: SourceResult[],
	existing: string[],
): FinderRow[] {
	const ordered = [...results].sort(
		(a, b) =>
			Number(b.source === "musicbrainz") - Number(a.source === "musicbrainz"),
	);
	const existingKeys = new Set(
		existing.filter((name) => name.trim()).map(normalizeName),
	);
	const rows: (FinderRow & { keys: Set<string> })[] = [];
	for (const result of ordered) {
		for (const writer of result.writers) {
			const keys = keysOf(writer.credited, writer.legal);
			const row = rows.find((candidate) =>
				keys.some((key) => candidate.keys.has(key)),
			);
			if (row) {
				if (!row.sources.includes(result.source))
					row.sources.push(result.source);
				row.legal ??= writer.legal;
				for (const key of keys) row.keys.add(key);
				continue;
			}
			rows.push({
				id: `${result.source}:${keys[0]}`,
				credited: writer.credited,
				legal: writer.legal,
				sources: [result.source],
				alreadyAdded: false,
				keys: new Set(keys),
			});
		}
	}
	return rows.map(({ keys, ...row }) => ({
		...row,
		alreadyAdded: [...keys].some((key) => existingKeys.has(key)),
	}));
}

/**
 * Ticked at the start: everyone not already added, except names only one
 * source found when another source also had credits.
 */
export function isPreselected(
	row: FinderRow,
	sourcesWithCredits: number,
): boolean {
	if (row.alreadyAdded) return false;
	return row.sources.length >= sourcesWithCredits;
}

/**
 * What an unattended lookup (the import) adds: the rows the finder would tick
 * at the start, by legal name.
 */
export function namesToAdd(
	results: SourceResult[],
	existing: string[],
): string[] {
	const rows = mergeWriters(results, existing);
	const withCredits = results.filter(
		(result) => result.writers.length > 0,
	).length;
	return rows
		.filter((row) => isPreselected(row, withCredits))
		.map((row) => nameFor(row, true));
}

export function nameFor(row: FinderRow, preferLegal: boolean): string {
	return preferLegal && row.legal ? row.legal : row.credited;
}

/** Adds names to the list, skipping empty slots and names already there. */
export function addSongwriters(existing: string[], names: string[]): string[] {
	const result = existing.filter((name) => name.trim());
	const keys = new Set(result.map(normalizeName));
	for (const name of names) {
		const key = normalizeName(name);
		if (!name.trim() || keys.has(key)) continue;
		keys.add(key);
		result.push(name.trim());
	}
	return result;
}
