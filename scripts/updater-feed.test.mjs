import { describe, expect, it } from "vitest";
import {
	replacesFeed,
	withReleaseNotes,
	withSignatures,
} from "./updater-feed.mjs";

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
				body: "Press **Try** or `B` to try new things",
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
		// Plain text: versions up to 0.22.0 show notes without rendering markdown.
		expect(result.notes).toBe(
			"New\n- Beta switch. Press Try or B to try new things\n\nFixed\n- Crash",
		);
		expect(result.entries).toEqual([
			{
				type: "feature",
				title: "Beta switch",
				body: "Press **Try** or `B` to try new things",
				highlight: false,
			},
			{ type: "fix", title: "Crash", highlight: true },
		]);
	});

	it("leaves the file alone without a changelog entry", () => {
		expect(withReleaseNotes(updater, releases, "0.23.0-3")).toBe(updater);
	});

	it("takes signatures from re-signed packages", () => {
		const base =
			"https://github.com/spicylyrics/ttml-tool/releases/download/v0.23.0-2";
		const file = {
			platforms: {
				"linux-x86_64-deb": {
					url: `${base}/AMLL.TTML.Tool_0.23.0-2_amd64.deb`,
					signature: "old",
				},
				"windows-x86_64": { url: `${base}/setup.exe`, signature: "keep" },
			},
		};
		const result = withSignatures(file, {
			"AMLL.TTML.Tool_0.23.0-2_amd64.deb": "new",
		});
		expect(result.platforms["linux-x86_64-deb"].signature).toBe("new");
		expect(result.platforms["windows-x86_64"].signature).toBe("keep");
	});

	it("moves the beta feed forward only", () => {
		expect(replacesFeed(null, "0.23.0-1")).toBe(true);
		expect(replacesFeed({ version: "0.23.0-1" }, "0.23.0-2")).toBe(true);
		expect(replacesFeed({ version: "0.23.0-2" }, "0.23.0")).toBe(true);
		expect(replacesFeed({ version: "0.23.0-2" }, "0.22.1")).toBe(false);
		expect(replacesFeed({ version: "0.23.0" }, "0.23.0")).toBe(false);
	});
});
