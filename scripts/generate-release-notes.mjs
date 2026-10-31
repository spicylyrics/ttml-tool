import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { SECTION_BY_TYPE } from "./compile-changelog.mjs";

const REPOSITORY = "https://github.com/spicylyrics/ttml-tool";

export const SECTION_HEADINGS = {
	new: "New",
	changed: "Changed",
	fixed: "Fixed",
};

export const sectionOf = (entry) =>
	SECTION_BY_TYPE[entry.type] ?? (entry.type ? "changed" : "new");

// "- **Lead.** Explanation", the explanation without its final period; a
// bold lead alone when there is no body. Same shape as the Discord post.
export const formatEntryLine = ({ title, body }) => {
	if (!body) return `- **${title}**`;
	const lead = /[.!?:]$/.test(title) ? title : `${title}.`;
	const text = body.replace(/\s*\n\s*/g, " ").replace(/(?<!\.)\.$/, "");
	return `- **${lead}** ${text}`;
};

const parse = (releases) =>
	typeof releases === "string" ? JSON.parse(releases) : releases;

// ## New / ## Changed / ## Fixed, empty sections left out.
const sections = (release, separator) =>
	Object.entries(SECTION_HEADINGS)
		.map(([section, heading]) => {
			const lines = release.entries
				.filter((entry) => sectionOf(entry) === section)
				.map(formatEntryLine);
			return lines.length ? [`## ${heading}`, ...lines].join("\n") : null;
		})
		.filter(Boolean)
		.join(separator);

/** GitHub release notes for one version, or null without entries. */
export const generateReleaseNotes = (releases, version) => {
	const release = parse(releases).find((item) => item.version === version);
	return release?.entries.length ? sections(release, "\n\n") : null;
};

/** The Discord announcement: no blank lines around headings, links in <>. */
export const generateDiscordPost = (releases, version) => {
	const data = parse(releases);
	const index = data.findIndex((item) => item.version === version);
	const release = data[index];
	if (!release?.entries.length) return null;
	const previous = data[index + 1]?.version;
	const changelogLink = previous
		? `${REPOSITORY}/compare/v${previous}...v${version}`
		: `${REPOSITORY}/commits/v${version}`;
	return [
		`# 📝 TTML Tool v${version}`,
		sections(release, "\n"),
		"",
		`**Full Changelog**: <${changelogLink}>`,
		"-# ||@TTML Tool Announcements||",
	].join("\n");
};

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const readArgument = (name) => {
		const index = process.argv.indexOf(name);
		return index === -1 ? undefined : process.argv[index + 1];
	};
	const version = readArgument("--version");
	const outputPath = readArgument("--output");
	// --changelog and --sectioned are accepted but ignored for older callers.
	if (!version) {
		console.error(
			"Usage: node scripts/generate-release-notes.mjs --version X.Y.Z [--discord] [--output file]",
		);
		process.exitCode = 1;
	} else {
		const generate = process.argv.includes("--discord")
			? generateDiscordPost
			: generateReleaseNotes;
		const notes = generate(
			readFileSync(
				new URL("../src/data/changelog.json", import.meta.url),
				"utf8",
			),
			version,
		);
		if (!notes) {
			console.warn(`No readable changelog entry found for v${version}.`);
			process.exitCode = 2;
		} else if (outputPath) {
			mkdirSync(dirname(resolve(outputPath)), { recursive: true });
			writeFileSync(outputPath, `${notes}\n`);
			console.log(`Generated release notes for v${version}.`);
		} else console.log(notes);
	}
}
