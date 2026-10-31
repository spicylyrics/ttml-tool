// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import {
	applySearchVisibility,
	clearSearchVisibility,
	collectPageElements,
	SEARCH_HIDDEN_ATTRIBUTE,
} from "./page-snapshot";

afterEach(() => {
	document.body.innerHTML = "";
});

function page(html: string) {
	const body = document.createElement("div");
	body.innerHTML = html;
	document.body.appendChild(body);
	return body;
}

describe("collectPageElements", () => {
	it("reads outermost cards as rows under the heading before them", () => {
		const body = page(`
			<div>
				<h3 class="rt-Heading">Display</h3>
				<div class="rt-Card">Language<div class="rt-Card">Nested</div></div>
				<div class="rt-Card">Compact</div>
			</div>
			<div>
				<h3>Privacy</h3>
				<div class="rt-Card"><h4>Discord</h4>presence</div>
			</div>
		`);
		const { snapshot, rows, groups } = collectPageElements(body);
		expect(snapshot.groups).toEqual(["Display", "Privacy"]);
		expect(snapshot.rows).toEqual([
			{ text: "LanguageNested", group: 0 },
			{ text: "Compact", group: 0 },
			{ text: "Discordpresence", group: 1 },
		]);
		expect(rows).toHaveLength(3);
		expect(groups).toHaveLength(2);
	});

	it("puts rows before any heading in no group", () => {
		const body = page(`<div class="rt-Card">Loose</div><h3>Later</h3>`);
		expect(collectPageElements(body).snapshot.rows).toEqual([
			{ text: "Loose", group: -1 },
		]);
	});
});

describe("search visibility", () => {
	it("hides and restores elements", () => {
		const body = page(
			`<div class="rt-Card">A</div><div class="rt-Card">B</div>`,
		);
		const { rows } = collectPageElements(body);
		applySearchVisibility(rows, [true, false]);
		expect(rows[0].hasAttribute(SEARCH_HIDDEN_ATTRIBUTE)).toBe(false);
		expect(rows[1].hasAttribute(SEARCH_HIDDEN_ATTRIBUTE)).toBe(true);
		clearSearchVisibility(body);
		expect(body.querySelectorAll(`[${SEARCH_HIDDEN_ATTRIBUTE}]`)).toHaveLength(
			0,
		);
	});

	it("does nothing when the page changed since it was read", () => {
		const body = page(`<div class="rt-Card">A</div>`);
		const { rows } = collectPageElements(body);
		applySearchVisibility(rows, [false, false]);
		expect(rows[0].hasAttribute(SEARCH_HIDDEN_ATTRIBUTE)).toBe(false);
	});
});
