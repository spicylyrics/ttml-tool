import { writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	assertMatchingVersions,
	bumpVersion,
	loadVersionSources,
	readVersions,
	updateVersionSources,
	VERSION_FILES,
} from "./version-utils.mjs";

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const positional = args.filter((arg) => arg !== "--dry-run");
if (
	positional.length < 1 ||
	positional.length > 2 ||
	(positional.length === 2 && positional[0] !== "beta")
) {
	throw new Error(
		"Usage: pnpm version:bump <patch|minor|major|beta [patch|minor|major]|stable> [--dry-run]",
	);
}

const root = process.cwd();
const sources = loadVersionSources(root);
const currentVersion = assertMatchingVersions(readVersions(sources));
const nextVersion = bumpVersion(currentVersion, positional[0], positional[1]);

if (dryRun) {
	console.log(`${currentVersion} -> ${nextVersion} (dry run)`);
} else {
	const updatedSources = updateVersionSources(
		sources,
		currentVersion,
		nextVersion,
	);
	for (const file of VERSION_FILES) {
		writeFileSync(join(root, file), updatedSources[file]);
	}
	console.log(
		`Updated ${currentVersion} -> ${nextVersion} in all version files.`,
	);
}
