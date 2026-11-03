import { readdirSync, readFileSync, unlinkSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { entryProblems } from "./changelog-format.mjs";
import {
	assertReleaseVersion,
	compareVersions,
	isBetaVersion,
	parseReleaseVersion,
} from "./version-utils.mjs";

export const RELEASE_COLORS = [
	"iris",
	"cyan",
	"violet",
	"orange",
	"teal",
	"ruby",
	"green",
	"blue",
];

// Note types in release order, and the section each one is listed under.
export const CHANGE_TYPES = ["feature", "change", "fix"];
export const SECTION_BY_TYPE = {
	feature: "new",
	change: "changed",
	fix: "fixed",
};

export function parseChangeNote(source, filename = "Change note") {
	const fail = (message) => {
		throw new Error(`${filename}: ${message}`);
	};
	const normalized = source.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n");
	const match = normalized.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
	if (!match) fail("expected frontmatter between two --- lines.");
	const fields = {};
	for (const line of match[1].split("\n")) {
		if (!line.trim() || line.trim().startsWith("#")) continue;
		const field = line.match(/^(type|impact|highlight|beta-only):\s*(.*?)\s*$/);
		if (!field) fail(`unknown or malformed frontmatter: ${line}`);
		if (Object.hasOwn(fields, field[1])) fail(`duplicate ${field[1]}.`);
		fields[field[1]] = field[2].replace(/\s+#.*$/, "");
	}
	if (!CHANGE_TYPES.includes(fields.type ?? ""))
		fail("type must be feature, change or fix.");
	if (!/^[1-5]$/.test(fields.impact ?? ""))
		fail("impact must be an integer from 1 to 5.");
	if (!/^(true|false)$/.test(fields.highlight ?? ""))
		fail("highlight must be true or false.");
	if (!/^(true|false)?$/.test(fields["beta-only"] ?? ""))
		fail("beta-only must be true or false.");
	const [title, ...rest] = match[2].trimEnd().split("\n");
	if (!title?.trim()) fail("a user-facing title is required.");
	if (rest.length && rest[0].trim())
		fail("leave a blank line between the title and body.");
	const body = rest.join("\n").trim();
	const problems = entryProblems({ title: title.trim(), body });
	if (problems.length) fail(`${problems.join("; ")} (see changes/README.md).`);
	return {
		type: fields.type,
		impact: Number(fields.impact),
		title: title.trim(),
		...(body ? { body } : {}),
		highlight: fields.highlight === "true",
		...(fields["beta-only"] === "true" ? { betaOnly: true } : {}),
	};
}

const isBetaRelease = (release) =>
	Boolean(release.version) && isBetaVersion(release.version);

/** The compiled betas a stable version finishes: 0.23.0 takes every 0.23.0-N. */
export function betasOf(releases, version) {
	if (isBetaVersion(version)) return [];
	return releases.filter(
		(release) =>
			isBetaRelease(release) &&
			parseReleaseVersion(release.version).base === version,
	);
}

/**
 * One release built from the pending notes. A beta (X.Y.Z-N) keeps each
 * entry's impact so the stable release can sort them again; the stable
 * X.Y.Z takes in every entry from its betas except beta-only fixes, and
 * those beta blocks are dropped from the changelog (see compileChangelog).
 */
export function createRelease(
	releases,
	notes,
	version,
	summary,
	date = new Date(),
) {
	assertReleaseVersion(version);
	if (
		!summary?.trim() ||
		summary.trim().split(/\s+/).length > 5 ||
		/[\r\n]/.test(summary)
	) {
		throw new Error("Summary must contain 1-5 words on one line.");
	}
	if (releases.some((release) => release.version === version)) {
		throw new Error(`Changelog already contains v${version}.`);
	}
	const newest = releases[0];
	if (newest?.version && compareVersions(version, newest.version) <= 0) {
		throw new Error(`Version must be newer than v${newest.version}.`);
	}
	const beta = isBetaVersion(version);
	const cycle = betasOf(releases, version);
	if (!beta) {
		const stray = releases.find(
			(release) => isBetaRelease(release) && !cycle.includes(release),
		);
		if (stray)
			throw new Error(
				`v${stray.version} is a beta of another version; release or drop it before v${version}.`,
			);
	}
	if (!notes.length && !cycle.length)
		throw new Error(
			"No change notes found in changes/*.md (README.md is excluded).",
		);
	// Oldest beta first, so equal-impact entries keep the order they shipped in.
	const pool = [
		...cycle.toReversed().flatMap((release) => release.entries),
		...notes,
	].filter((entry) => beta || !entry.betaOnly);
	if (!pool.length)
		throw new Error(`Every entry for v${version} is beta-only.`);
	const previous = beta
		? newest
		: releases.find((release) => !cycle.includes(release));
	const colorIndex = RELEASE_COLORS.indexOf(previous?.color);
	const entries = pool
		.sort((a, b) => {
			if (a.type !== b.type)
				return CHANGE_TYPES.indexOf(a.type) - CHANGE_TYPES.indexOf(b.type);
			return (b.impact ?? 0) - (a.impact ?? 0);
		})
		.map(({ impact, betaOnly, ...entry }) =>
			beta ? { ...entry, impact, ...(betaOnly ? { betaOnly } : {}) } : entry,
		);
	return {
		version,
		summary: summary.trim(),
		color: RELEASE_COLORS[(colorIndex + 1) % RELEASE_COLORS.length],
		date: date.toISOString().slice(0, 10),
		...(beta ? { prerelease: true } : {}),
		entries,
	};
}

export function compileChangelog(
	root,
	{ version, summary, dryRun = false, date },
) {
	const directory = join(root, "changes");
	const files = readdirSync(directory)
		.filter((file) => file.endsWith(".md") && file !== "README.md")
		.sort();
	const notes = files.map((file) =>
		parseChangeNote(
			readFileSync(join(directory, file), "utf8"),
			`changes/${file}`,
		),
	);
	const output = join(root, "src/data/changelog.json");
	const releases = JSON.parse(readFileSync(output, "utf8"));
	const release = createRelease(releases, notes, version, summary, date);
	const merged = betasOf(releases, version);
	const kept = releases.filter((item) => !merged.includes(item));
	if (!dryRun) {
		writeFileSync(
			output,
			`${JSON.stringify([release, ...kept], null, "\t")}\n`,
		);
		for (const file of files) unlinkSync(join(directory, file));
	}
	return release;
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	try {
		const args = process.argv.slice(2);
		const options = { dryRun: false };
		for (let i = 0; i < args.length; i++) {
			if (args[i] === "--dry-run") options.dryRun = true;
			else if (
				["--version", "--summary"].includes(args[i]) &&
				args[i + 1] &&
				!args[i + 1].startsWith("--")
			)
				options[args[i].slice(2)] = args[++i];
			else
				throw new Error(
					'Usage: pnpm changelog:compile --version <X.Y.Z|X.Y.Z-N> --summary "Short summary" [--dry-run]',
				);
		}
		const release = compileChangelog(process.cwd(), options);
		console.log(JSON.stringify(release, null, "\t"));
		if (!options.dryRun)
			console.log(`Compiled v${release.version} and removed its change notes.`);
	} catch (error) {
		console.error(error.message);
		process.exitCode = 1;
	}
}
