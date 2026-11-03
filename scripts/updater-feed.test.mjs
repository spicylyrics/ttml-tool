import { describe, expect, it } from "vitest";
import { replacesFeed, withReleaseNotes } from "./updater-feed.mjs";

const updater = {
	version: "0.23.0-2",
	notes: "Desktop release v0.23.0-2. Release notes are finalized later.",
	platforms: { "windows-x86_64": { url: "x", signature: "y" } },
};
const releases = [
	{
		version: "0.23.0-2",
		prerelease: true,
		entries: [
			{
				type: "feature",
				title: "Beta switch",
				body: "Try new things",
				impact: 3,
			},
			{
				type: "fix",
				title: "Crash",
				highlight: true,
				impact: 2,
				betaOnly: true,
			},
		],
	},
];

describe("updater feed", () => {
	it("writes the release's entries and notes into the updater file", () => {
		const result = withReleaseNotes(updater, releases, "0.23.0-2");
		expect(result.platforms).toBe(updater.platforms);
		expect(result.notes).toBe(
			"## New\n- **Beta switch.** Try new things\n\n## Fixed\n- **Crash**",
		);
		expect(result.entries).toEqual([
			{
				type: "feature",
				title: "Beta switch",
				body: "Try new things",
				highlight: false,
			},
			{ type: "fix", title: "Crash", highlight: true },
		]);
	});

	it("leaves the file alone without a changelog entry", () => {
		expect(withReleaseNotes(updater, releases, "0.23.0-3")).toBe(updater);
	});

	it("moves the beta feed forward only", () => {
		expect(replacesFeed(null, "0.23.0-1")).toBe(true);
		expect(replacesFeed({ version: "0.23.0-1" }, "0.23.0-2")).toBe(true);
		expect(replacesFeed({ version: "0.23.0-2" }, "0.23.0")).toBe(true);
		expect(replacesFeed({ version: "0.23.0-2" }, "0.22.1")).toBe(false);
		expect(replacesFeed({ version: "0.23.0" }, "0.23.0")).toBe(false);
	});
});
