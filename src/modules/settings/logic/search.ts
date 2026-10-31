import {
	matchesSettingsPage,
	matchesSettingsSearch,
} from "../logic/settings-search";

/** One setting row (a card) and the index of the heading it sits under, or -1. */
export interface SearchRow {
	text: string;
	group: number;
}

/** What a rendered page reads as: its whole text, its headings and its rows. */
export interface PageSnapshot {
	text: string;
	groups: string[];
	rows: SearchRow[];
}

export interface SearchablePage {
	value: string;
	label: string;
	keywords: string;
}

export interface PageSearchResult {
	value: string;
	/** The page stays in the sidebar. */
	visible: boolean;
	/** Rows that match the query on their own. 0 when the page shows whole. */
	matchCount: number;
	/** Per row of the snapshot: keep it shown. */
	rows: boolean[];
	/** Per heading of the snapshot: keep it shown. */
	groups: boolean[];
}

export function isSearchQuery(query: string): boolean {
	return query.trim() !== "";
}

function showWhole(
	value: string,
	visible: boolean,
	snapshot: PageSnapshot | undefined,
): PageSearchResult {
	return {
		value,
		visible,
		matchCount: 0,
		rows: snapshot?.rows.map(() => true) ?? [],
		groups: snapshot?.groups.map(() => true) ?? [],
	};
}

/**
 * Decides, per page, whether it matches the query and which of its rows to
 * keep. A row matches on its own text plus the heading above it, so "display
 * language" finds the language row under Display. When nothing on a page
 * matches row by row (it matched on its label, keywords or text outside the
 * cards), or the query names the page itself, the page shows whole.
 */
export function searchSettingsPages(
	pages: SearchablePage[],
	snapshots: Record<string, PageSnapshot> | null,
	query: string,
): PageSearchResult[] {
	if (!isSearchQuery(query)) {
		return pages.map((page) =>
			showWhole(page.value, true, snapshots?.[page.value]),
		);
	}
	return pages.map((page) => {
		const snapshot = snapshots?.[page.value];
		const rowMatches =
			snapshot?.rows.map((row) =>
				matchesSettingsSearch(
					`${snapshot.groups[row.group] ?? ""} ${row.text}`,
					query,
				),
			) ?? [];
		const matchCount = rowMatches.filter(Boolean).length;
		const pageMatches =
			matchCount > 0 ||
			matchesSettingsPage(
				{ label: page.label, keywords: page.keywords, text: snapshot?.text },
				query,
			);
		if (
			!snapshot ||
			matchCount === 0 ||
			matchesSettingsSearch(page.label, query)
		) {
			return showWhole(page.value, pageMatches, snapshot);
		}
		const groups = snapshot.groups.map((_, index) => {
			const groupRows = snapshot.rows
				.map((row, rowIndex) => (row.group === index ? rowIndex : -1))
				.filter((rowIndex) => rowIndex !== -1);
			// A heading with no rows under it is page structure, not a setting.
			return groupRows.length === 0 || groupRows.some((i) => rowMatches[i]);
		});
		return {
			value: page.value,
			visible: true,
			matchCount,
			rows: rowMatches,
			groups,
		};
	});
}

/** Stay on the current page while it matches, else jump to the first match. */
export function pickActivePage(
	current: string,
	results: PageSearchResult[],
): string {
	const visible = results.filter((result) => result.visible);
	if (visible.some((result) => result.value === current)) return current;
	return visible[0]?.value ?? current;
}

export function sameSnapshots(
	a: Record<string, PageSnapshot> | null,
	b: Record<string, PageSnapshot> | null,
): boolean {
	return JSON.stringify(a) === JSON.stringify(b);
}
