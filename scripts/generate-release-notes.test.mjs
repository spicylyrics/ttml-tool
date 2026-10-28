import { describe, expect, it } from "vitest";
import {
	generateReleaseNotes,
	generateSectionedReleaseNotes,
	sectionOf,
} from "./generate-release-notes.mjs";

const changelog = [
	{
		version: "0.7.3",
		entries: [
			{
				type: "fix",
				title: "Desktop Update Fix",
				body: "Use \x60latest.json\x60 for updates.",
			},
			{
				type: "feature",
				title: "Formatting",
				body: "Keep **important** notes readable.\nAnd [links](https://example.com).",
			},
			{ type: "fix", title: "Title only" },
		],
	},
	{ version: "0.7.30", entries: [{ title: "Another release" }] },
];
describe("generateReleaseNotes", () => {
	it("renders the exact matching JSON release as Markdown", () => {
		expect(generateReleaseNotes(changelog, "0.7.3")).toBe(
			"- **Desktop Update Fix:** Use \x60latest.json\x60 for updates.\n- **Formatting:** Keep **important** notes readable. And [links](https://example.com).\n- **Title only**",
		);
		expect(generateReleaseNotes(JSON.stringify(changelog), "0.7.3")).toBe(
			generateReleaseNotes(changelog, "0.7.3"),
		);
	});
	it("renders the sectioned format with bold leads and plain one-liners", () => {
		const release = [
			{
				version: "0.17.0",
				entries: [
					{ type: "feature", title: "New screen", body: "Opens\nfast." },
					{ type: "feature", title: "Ends with a question?", body: "Yes." },
					{ type: "change", title: "Renamed a setting" },
					{ type: "fix", title: "Crash on save", body: "Fixed." },
				],
			},
		];
		expect(generateSectionedReleaseNotes(release, "0.17.0")).toBe(
			"## New\n- **New screen.** Opens fast.\n- **Ends with a question?** Yes.\n\n## Changed\n- Renamed a setting\n\n## Fixed\n- **Crash on save.** Fixed.",
		);
		expect(generateSectionedReleaseNotes(changelog, "0.7.3")).toBe(
			"## New\n- **Formatting.** Keep **important** notes readable. And [links](https://example.com).\n\n## Fixed\n- **Desktop Update Fix.** Use \x60latest.json\x60 for updates.\n- Title only",
		);
		expect(generateSectionedReleaseNotes(changelog, "0.7.4")).toBeNull();
	});
	it("maps note types to sections, including entries without a type", () => {
		expect(sectionOf({ type: "feature" })).toBe("new");
		expect(sectionOf({ type: "change" })).toBe("changed");
		expect(sectionOf({ type: "fix" })).toBe("fixed");
		expect(sectionOf({})).toBe("new");
		expect(sectionOf({ type: "other" })).toBe("changed");
	});
	it("returns null for a missing or empty release", () => {
		expect(generateReleaseNotes(changelog, "0.7.4")).toBeNull();
		expect(
			generateReleaseNotes([{ version: "0.7.4", entries: [] }], "0.7.4"),
		).toBeNull();
	});
});
