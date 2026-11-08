import { describe, expect, it } from "vitest";
import {
	generateDiscordPost,
	generateReleaseNotes,
	sectionOf,
} from "./generate-release-notes.mjs";

const changelog = [
	{
		version: "0.17.0",
		entries: [
			{ type: "feature", title: "New screen", body: "Opens\nfast." },
			{ type: "feature", title: "Ends with a question?", body: "Yes" },
			{ type: "change", title: "Renamed a setting" },
			{ type: "fix", title: "Crash on save", body: "Saving works again" },
			{ type: "fix", title: "Trailing dots", body: "Wait for it..." },
		],
	},
	{ version: "0.16.0", entries: [{ title: "Untyped entry", body: "Is new" }] },
];

describe("generateReleaseNotes", () => {
	it("renders sections with bold leads and no final period", () => {
		expect(generateReleaseNotes(changelog, "0.17.0")).toBe(
			"## New\n- **New screen.** Opens fast\n- **Ends with a question?** Yes\n\n## Changed\n- **Renamed a setting**\n\n## Fixed\n- **Crash on save.** Saving works again\n- **Trailing dots.** Wait for it...",
		);
		expect(generateReleaseNotes(JSON.stringify(changelog), "0.16.0")).toBe(
			"## New\n- **Untyped entry.** Is new",
		);
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
		expect(generateDiscordPost(changelog, "0.7.4")).toBeNull();
	});
});

describe("generateDiscordPost", () => {
	it("wraps the notes with the title, compare link and ping", () => {
		expect(generateDiscordPost(changelog, "0.17.0")).toBe(
			[
				"# 📝 TTML Tool v0.17.0",
				"## New",
				"- **New screen.** Opens fast",
				"- **Ends with a question?** Yes",
				"## Changed",
				"- **Renamed a setting**",
				"## Fixed",
				"- **Crash on save.** Saving works again",
				"- **Trailing dots.** Wait for it...",
				"",
				"**Full Changelog**: <https://github.com/spicylyrics/ttml-tool/compare/v0.16.0...v0.17.0>",
				"-# ||@TTML Tool Announcements||",
			].join("\n"),
		);
	});
	it("titles betas by number, links the previous beta and pings nobody", () => {
		const betas = [
			{
				version: "0.18.0-2",
				prerelease: true,
				entries: [{ type: "fix", title: "Crash", body: "Gone", impact: 3 }],
			},
			{ version: "0.18.0-1", prerelease: true, entries: [] },
		];
		const post = generateDiscordPost(betas, "0.18.0-2");
		expect(post.split("\n")[0]).toBe("# 📝 TTML Tool v0.18.0 Beta 2");
		expect(post).toContain("compare/v0.18.0-1...v0.18.0-2>");
		expect(post).not.toContain("@");
	});
	it("links the tag's commits when there is no earlier release", () => {
		expect(generateDiscordPost(changelog, "0.16.0")).toContain(
			"<https://github.com/spicylyrics/ttml-tool/commits/v0.16.0>",
		);
	});
});
