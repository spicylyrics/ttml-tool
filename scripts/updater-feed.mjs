// The updater files a release publishes. latest.json is the stable feed
// (served from the Latest release); beta.json, on the rolling update-feed
// release, is the beta feed. The release workflow calls this from
// finalize-release:
//   notes --file latest.json --version X [--signatures dir]
//                                          puts the changelog entries (and
//                                          any re-signed .sig files) in
//   newer --feed beta.json --version X     exits 0 when X should replace that feed

import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import {
	formatEntryLine,
	SECTION_HEADINGS,
	sectionOf,
} from "./generate-release-notes.mjs";
import { compareVersions } from "./version-utils.mjs";

/**
 * The release notes as plain text. Versions up to 0.22.0 show `notes` as is,
 * so markdown would reach them as literal ** and #.
 */
export function plainNotes(release) {
	return Object.entries(SECTION_HEADINGS)
		.map(([section, heading]) => {
			const lines = release.entries
				.filter((entry) => sectionOf(entry) === section)
				.map((entry) => formatEntryLine(entry).replace(/\*\*|`/g, ""));
			return lines.length ? [heading, ...lines].join("\n") : null;
		})
		.filter(Boolean)
		.join("\n\n");
}

/**
 * The updater file with the release's notes: `notes` as plain text for older
 * versions' update card, and `entries` for the current one.
 */
export function withReleaseNotes(updater, releases, version) {
	const release = releases.find((item) => item.version === version);
	if (!release?.entries.length) return updater;
	return {
		...updater,
		notes: plainNotes(release),
		entries: release.entries.map(({ type, title, body, highlight }) => ({
			type,
			title,
			...(body ? { body } : {}),
			highlight: Boolean(highlight),
		})),
	};
}

/**
 * The updater file with each platform's signature taken from the release's
 * `<file>.sig`, for packages signed again after tauri-action wrote it (the
 * beta .deb and .rpm, repacked with a pre-release version).
 */
export function withSignatures(updater, signatures) {
	const platforms = Object.fromEntries(
		Object.entries(updater.platforms ?? {}).map(([target, platform]) => {
			const file = decodeURIComponent(platform.url.split("/").pop() ?? "");
			const signature = signatures[file];
			return [target, signature ? { ...platform, signature } : platform];
		}),
	);
	return { ...updater, platforms };
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
		const directory = option("--signatures");
		const signatures = directory
			? Object.fromEntries(
					readdirSync(directory)
						.filter((name) => name.endsWith(".sig"))
						.map((name) => [
							name.slice(0, -".sig".length),
							readFileSync(join(directory, name), "utf8").trim(),
						]),
				)
			: {};
		const updated = withSignatures(
			withReleaseNotes(
				JSON.parse(readFileSync(file, "utf8")),
				releases,
				version,
			),
			signatures,
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
