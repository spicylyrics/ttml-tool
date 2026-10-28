import { uid } from "uid";
import {
	normalizeSectionHeader,
	sectionCategoryLabel,
} from "$/modules/lyric-editor/utils/section-system.ts";
import type { LyricSection, LyricSectionCategory } from "$/types/ttml.ts";

/**
 * Reads Apple's `itunes:song-part` (on a line's `<div>` or on the `<p>`)
 * into editor sections while a TTML is parsed. Values like `PreChorus` map
 * onto our categories; unknown ones become "other" and keep their name.
 * One section per `<div>`, so two adjacent Verse divs stay two verses.
 * Read only: the writer never emits song-part.
 */
export function createSongPartReader() {
	const sections: LyricSection[] = [];
	const ordinals = new Map<LyricSectionCategory, number>();
	let previousKey: unknown;
	let previousId: string | undefined;

	const sectionIdFor = (
		lineEl: Element,
		getValue: (el: Element) => string | null,
	) => {
		let owner: Element | null = lineEl;
		let value: string | null = null;
		while (owner && owner.localName !== "body") {
			value = getValue(owner)?.trim() || null;
			if (value) break;
			owner = owner.parentElement;
		}
		if (!owner || !value) {
			previousKey = undefined;
			return undefined;
		}
		// Song-parts set per <p> merge with the run of same-valued lines.
		const key = owner === lineEl ? `p:${value}` : owner;
		if (key === previousKey && previousId) return previousId;
		const category = normalizeSectionHeader(`[${value}]`)?.category ?? "other";
		const ordinal = (ordinals.get(category) ?? 0) + 1;
		ordinals.set(category, ordinal);
		const section: LyricSection = {
			id: uid(),
			label:
				category === "other"
					? `[${value}]`
					: `[${sectionCategoryLabel(category)} ${ordinal}]`,
			category,
			ordinal: category === "other" ? undefined : ordinal,
			confidence: category === "other" ? 0.35 : 1,
		};
		sections.push(section);
		previousKey = key;
		previousId = section.id;
		return section.id;
	};

	return { sectionIdFor, sections };
}
