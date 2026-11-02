// Shapes the compiled changelog (src/data/changelog.json and the legacy block)
// into release cards for the changelog screen. Reads old entries as they are:
// a missing type counts as new, a missing highlight as false.

export type ChangeSection = "new" | "changed" | "fixed";

export const SECTION_ORDER: readonly ChangeSection[] = [
	"new",
	"changed",
	"fixed",
];

export interface ChangeEntry {
	type?: string;
	title: string;
	body?: string;
	highlight?: boolean;
}

export interface CompiledRelease {
	version?: string;
	summary?: string;
	heading?: string;
	color?: string;
	date?: string;
	entries: readonly ChangeEntry[];
}

export interface ReleaseCard {
	key: string;
	version?: string;
	summary?: string;
	date?: string;
	color?: string;
	highlights: ChangeEntry[];
	sections: { section: ChangeSection; entries: ChangeEntry[] }[];
}

const SECTION_BY_TYPE: Record<string, ChangeSection> = {
	feature: "new",
	change: "changed",
	fix: "fixed",
};

export const sectionOf = (entry: Pick<ChangeEntry, "type">): ChangeSection =>
	entry.type ? (SECTION_BY_TYPE[entry.type] ?? "changed") : "new";

export function toReleaseCard(
	release: CompiledRelease,
	{ highlightsOnly = false } = {},
): ReleaseCard {
	const highlights = release.entries.filter((entry) => entry.highlight);
	const rest = highlightsOnly
		? []
		: release.entries.filter((entry) => !entry.highlight);
	return {
		key: release.version ?? release.heading ?? release.summary ?? "",
		version: release.version,
		summary: release.summary ?? release.heading,
		date: release.date,
		color: release.color,
		highlights,
		sections: SECTION_ORDER.map((section) => ({
			section,
			entries: rest.filter((entry) => sectionOf(entry) === section),
		})).filter((group) => group.entries.length > 0),
	};
}

export interface ReleaseGroup {
	/** "0.18" for 0.18.x releases, or null for the legacy block. */
	minor: string | null;
	cards: ReleaseCard[];
}

/** "0.18.1" and "0.18" both give "0.18". */
export const minorOf = (version: string) =>
	version.split(".").slice(0, 2).join(".");

/** Consecutive cards of the same minor version, in order; the legacy block last. */
export function groupReleaseCards(
	cards: readonly ReleaseCard[],
): ReleaseGroup[] {
	const groups: ReleaseGroup[] = [];
	for (const card of cards) {
		const minor = card.version ? minorOf(card.version) : null;
		const last = groups[groups.length - 1];
		if (last && last.minor === minor) last.cards.push(card);
		else groups.push({ minor, cards: [card] });
	}
	return groups;
}

/** Releases newest first, then the legacy block; empty cards are left out. */
export function buildReleaseCards(
	releases: readonly CompiledRelease[],
	legacy?: CompiledRelease,
	options: { highlightsOnly?: boolean } = {},
): ReleaseCard[] {
	return [...releases, ...(legacy ? [legacy] : [])]
		.map((release) => toReleaseCard(release, options))
		.filter((card) => card.highlights.length || card.sections.length);
}
