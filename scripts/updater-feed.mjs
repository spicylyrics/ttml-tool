// The updater files a release publishes. latest.json is the stable feed
// (served from the Latest release); beta.json, on the rolling update-feed
// release, is the beta feed. The release workflow calls this from
// finalize-release:
//   notes --file latest.json --version X   puts the changelog entries in
//   newer --feed beta.json --version X     exits 0 when X should replace that feed

import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { generateReleaseNotes } from "./generate-release-notes.mjs";
import { compareVersions } from "./version-utils.mjs";

/**
 * The updater file with the release's notes: `notes` as the plain one-line
 * entries GitHub shows, and `entries` for the in-app update card.
 */
export function withReleaseNotes(updater, releases, version) {
	const release = releases.find((item) => item.version === version);
	const notes = generateReleaseNotes(releases, version);
	if (!release || !notes) return updater;
	return {
		...updater,
		notes,
		entries: release.entries.map(({ type, title, body, highlight }) => ({
			type,
			title,
			...(body ? { body } : {}),
			highlight: Boolean(highlight),
		})),
	};
}

/**
 * Whether a release should become the beta feed. Stable releases count too,
 * so beta users move on to the stable version once it passes their beta, but
 * a hotfix older than the current beta must not replace it.
 */
export function replacesFeed(feed, version) {
	if (!feed?.version) return true;
	return compareVersions(version, feed.version) > 0;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const [command, ...args] = process.argv.slice(2);
	const option = (name) => {
		const index = args.indexOf(name);
		return index === -1 ? undefined : args[index + 1];
	};
	const version = option("--version");
	if (command === "notes" && option("--file") && version) {
		const file = option("--file");
		const releases = JSON.parse(
			readFileSync(
				new URL("../src/data/changelog.json", import.meta.url),
				"utf8",
			),
		);
		const updated = withReleaseNotes(
			JSON.parse(readFileSync(file, "utf8")),
			releases,
			version,
		);
		writeFileSync(file, `${JSON.stringify(updated, null, 2)}\n`);
		console.log(
			updated.entries
				? `Wrote v${version}'s notes into ${file}.`
				: `No changelog entry for v${version}; left ${file}'s notes as they were.`,
		);
	} else if (command === "newer" && option("--feed") && version) {
		const file = option("--feed");
		const feed = existsSync(file)
			? JSON.parse(readFileSync(file, "utf8"))
			: null;
		const replace = replacesFeed(feed, version);
		console.log(
			replace
				? `v${version} becomes the beta feed.`
				: `The beta feed stays on v${feed.version}, which is newer than v${version}.`,
		);
		if (!replace) process.exitCode = 3;
	} else {
		console.error(
			"Usage: node scripts/updater-feed.mjs notes --file latest.json --version X\n       node scripts/updater-feed.mjs newer --feed beta.json --version X",
		);
		process.exitCode = 1;
	}
}
