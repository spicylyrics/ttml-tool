import type { PageSnapshot, SearchRow } from "./search";

/** A setting row: a FieldRow, or a card on pages not yet built from them. */
export const ROW_SELECTOR = "[data-field-row], .rt-Card";
const HEADING_SELECTOR = "h1, h2, h3, h4, h5, h6";

/** The attribute the shell sets on rows and headings a search filters out. */
export const SEARCH_HIDDEN_ATTRIBUTE = "data-search-hidden";

export interface PageElements {
	snapshot: PageSnapshot;
	rows: HTMLElement[];
	groups: HTMLElement[];
}

function isNestedIn(element: Element, selector: string, root: Element) {
	const outer = element.parentElement?.closest(selector);
	return Boolean(outer && root.contains(outer));
}

/**
 * Reads a rendered page without knowing its components: every outermost row
 * is a row, and every heading outside a card starts a group that the rows
 * after it belong to. The pages stay untouched; this only reads their DOM.
 */
export function collectPageElements(body: Element): PageElements {
	const rows: HTMLElement[] = [];
	const groups: HTMLElement[] = [];
	const rowData: SearchRow[] = [];
	const groupText: string[] = [];
	const candidates = body.querySelectorAll<HTMLElement>(
		`${ROW_SELECTOR}, ${HEADING_SELECTOR}`,
	);
	for (const element of candidates) {
		if (element.matches(ROW_SELECTOR)) {
			if (isNestedIn(element, ROW_SELECTOR, body)) continue;
			rows.push(element);
			rowData.push({
				text: element.textContent ?? "",
				group: groups.length - 1,
			});
		} else if (!isNestedIn(element, ROW_SELECTOR, body)) {
			groups.push(element);
			groupText.push(element.textContent ?? "");
		}
	}
	return {
		snapshot: {
			text: body.textContent ?? "",
			groups: groupText,
			rows: rowData,
		},
		rows,
		groups,
	};
}

/** Hides what `shown` marks false. Lengths must match the collected elements. */
export function applySearchVisibility(
	elements: HTMLElement[],
	shown: boolean[],
): void {
	if (elements.length !== shown.length) return;
	elements.forEach((element, index) => {
		element.toggleAttribute(SEARCH_HIDDEN_ATTRIBUTE, !shown[index]);
	});
}

export function clearSearchVisibility(root: Element): void {
	for (const element of root.querySelectorAll(`[${SEARCH_HIDDEN_ATTRIBUTE}]`)) {
		element.removeAttribute(SEARCH_HIDDEN_ATTRIBUTE);
	}
}
