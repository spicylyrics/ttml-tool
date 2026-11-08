import {
	mkdirSync,
	mkdtempSync,
	readdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import {
	compileChangelog,
	createRelease,
	parseChangeNote,
	RELEASE_COLORS,
} from "./compile-changelog.mjs";

const note = (
	type = "fix",
	impact = 3,
	highlight = false,
	title = "A change",
) =>
	`---\ntype: ${type}\nimpact: ${impact}\nhighlight: ${highlight}\n---\n${title}\n\nKeep **bold** and \`code\` readable\n`;
const previous = [{ version: "0.10.3", color: "iris", entries: [] }];
const directories = [];
afterEach(() => {
	for (const directory of directories.splice(0))
		rmSync(directory, { recursive: true, force: true });
});
function fixture() {
	const root = mkdtempSync(join(tmpdir(), "ttml-changelog-"));
	directories.push(root);
	mkdirSync(join(root, "changes"));
	mkdirSync(join(root, "src/data"), { recursive: true });
	writeFileSync(join(root, "changes/README.md"), "Documentation, not a note");
	writeFileSync(join(root, "changes/test.md"), note());
	writeFileSync(
		join(root, "src/data/changelog.json"),
		JSON.stringify(previous),
	);
	return root;
}
describe("change note compilation", () => {
	it("parses CRLF, comments, titles, bodies, and highlights", () => {
		expect(
			parseChangeNote(
				note("feature", 5, true)
					.replace("impact: 5", "impact: 5 # biggest")
					.replaceAll("\n", "\r\n"),
			),
		).toEqual({
			type: "feature",
			impact: 5,
			highlight: true,
			title: "A change",
			body: "Keep **bold** and `code` readable",
		});
	});
	it.each([
		["type: fix", "type: changed", "type"],
		["impact: 3", "impact: 6", "impact"],
		["impact: 3", "impact: 1.5", "impact"],
		["highlight: false", "highlight: yes", "highlight"],
		["impact: 3", "", "impact"],
		["type: fix", "type: fix\ntype: feature", "duplicate"],
		["type: fix", "extra: value", "unknown"],
		["A change", "", "title"],
		["A change\n\n", "A change\n", "blank line"],
		["---\ntype", "type", "frontmatter"],
		["A change\n", "A change.\n", "punctuation"],
		["readable\n", "readable. Then more\n", "one sentence"],
		["\n\nKeep **bold** and `code` readable", "", "body"],
	])("rejects invalid notes with the filename (%s)", (from, to, message) => {
		expect(() =>
			parseChangeNote(note().replace(from, to), "changes/bad.md"),
		).toThrow(new RegExp(`changes/bad.md:.*${message}`));
	});
	it("orders features before fixes by descending impact with stable ties", () => {
		const notes = [
			parseChangeNote(note("fix", 5, true, "Fix")),
			parseChangeNote(note("feature", 1, false, "Small")),
			parseChangeNote(note("feature", 5, true, "Big")),
			parseChangeNote(note("feature", 5, false, "Tie")),
			parseChangeNote(note("change", 2, false, "Tweak")),
		];
		const release = createRelease(
			previous,
			notes,
			"0.10.4",
			"Test",
			new Date("2026-10-10T12:00:00Z"),
		);
		expect(release.entries.map((entry) => entry.title)).toEqual([
			"Big",
			"Tie",
			"Small",
			"Tweak",
			"Fix",
		]);
		expect(release.entries[0].highlight).toBe(true);
		expect(release.entries[0]).not.toHaveProperty("impact");
		expect(release.date).toBe("2026-10-10");
		for (const color of [...RELEASE_COLORS, "gold"]) {
			const next = createRelease(
				[{ ...previous[0], color }],
				notes,
				"0.10.4",
				"Test",
			);
			expect(RELEASE_COLORS).toContain(next.color);
			expect(next.color).not.toBe(color);
		}
	});
	it("rejects duplicate/older versions, empty releases, and long summaries", () => {
		const notes = [parseChangeNote(note())];
		expect(() => createRelease(previous, notes, "0.10.3", "Test")).toThrow(
			"already contains",
		);
		expect(() => createRelease(previous, notes, "0.9.9", "Test")).toThrow(
			"newer",
		);
		expect(() => createRelease(previous, notes, "v0.10.4", "Test")).toThrow(
			"SemVer",
		);
		expect(() =>
			createRelease(previous, notes, "0.10.4", "One two three four five six"),
		).toThrow("1-5");
		expect(() => createRelease(previous, notes, "0.10.4", "")).toThrow("1-5");
		expect(() => createRelease(previous, [], "0.10.4", "Test")).toThrow(
			"No change notes",
		);
	});
	it("compiles past old releases whose versions aren't SemVer", () => {
		const releases = [...previous, { version: "0.7", entries: [] }];
		const notes = [parseChangeNote(note())];
		expect(createRelease(releases, notes, "0.10.4", "Test").version).toBe(
			"0.10.4",
		);
	});
	it("compiles betas with impact kept, then folds them into the stable release", () => {
		const beta1 = createRelease(
			previous,
			[
				parseChangeNote(note("feature", 2, false, "Small")),
				parseChangeNote(note("fix", 4, false, "Old crash")),
			],
			"0.11.0-1",
			"First beta",
		);
		expect(beta1.prerelease).toBe(true);
		expect(beta1.entries[0]).toMatchObject({ title: "Small", impact: 2 });
		const fixOfBeta = parseChangeNote(
			note("fix", 5, false, "Beta crash").replace(
				"highlight: false",
				"highlight: false\nbeta-only: true",
			),
		);
		expect(fixOfBeta.betaOnly).toBe(true);
		const beta2 = createRelease(
			[beta1, ...previous],
			[parseChangeNote(note("feature", 5, true, "Big")), fixOfBeta],
			"0.11.0-2",
			"Second beta",
		);
		expect(beta2.entries.map((entry) => entry.title)).toEqual([
			"Big",
			"Beta crash",
		]);
		expect(beta2.entries[1].betaOnly).toBe(true);
		const releases = [beta2, beta1, ...previous];
		expect(() => createRelease(releases, [], "0.11.0-2", "Again")).toThrow(
			"already contains",
		);
		expect(() => createRelease(releases, [], "0.10.9", "Older")).toThrow(
			"newer",
		);
		const stable = createRelease(releases, [], "0.11.0", "Stable");
		expect(stable).not.toHaveProperty("prerelease");
		expect(stable.entries.map((entry) => entry.title)).toEqual([
			"Big",
			"Small",
			"Old crash",
		]);
		expect(stable.entries[0]).not.toHaveProperty("impact");
		expect(stable.color).toBe(RELEASE_COLORS[1]);
		expect(() =>
			createRelease([beta1, ...previous], [], "0.12.0", "X"),
		).toThrow("beta of another version");
	});
	it("drops the folded betas from the changelog file", () => {
		const root = fixture();
		const output = join(root, "src/data/changelog.json");
		compileChangelog(root, { version: "0.11.0-1", summary: "Beta" });
		writeFileSync(
			join(root, "changes/more.md"),
			note("feature", 3, false, "More"),
		);
		const stable = compileChangelog(root, {
			version: "0.11.0",
			summary: "Done",
		});
		expect(stable.entries.map((entry) => entry.title)).toEqual([
			"More",
			"A change",
		]);
		expect(
			JSON.parse(readFileSync(output, "utf8")).map((item) => item.version),
		).toEqual(["0.11.0", "0.10.3"]);
	});
	it("dry runs leave data and notes untouched; compilation consumes only notes", () => {
		const root = fixture();
		const output = join(root, "src/data/changelog.json");
		const before = readFileSync(output, "utf8");
		const options = {
			version: "0.10.4",
			summary: "Test",
			date: new Date("2026-10-10"),
		};
		const preview = compileChangelog(root, { ...options, dryRun: true });
		expect(readFileSync(output, "utf8")).toBe(before);
		expect(readdirSync(join(root, "changes")).sort()).toEqual([
			"README.md",
			"test.md",
		]);
		expect(compileChangelog(root, options)).toEqual(preview);
		expect(JSON.parse(readFileSync(output, "utf8"))).toEqual([
			preview,
			...previous,
		]);
		expect(readdirSync(join(root, "changes")).sort()).toEqual(["README.md"]);
	});
	it("validates every note before writing or deleting anything", () => {
		const root = fixture();
		writeFileSync(join(root, "changes/bad.md"), "Broken");
		const output = join(root, "src/data/changelog.json");
		const before = readFileSync(output, "utf8");
		expect(() =>
			compileChangelog(root, { version: "0.10.4", summary: "Test" }),
		).toThrow("changes/bad.md");
		expect(readFileSync(output, "utf8")).toBe(before);
		expect(readdirSync(join(root, "changes")).sort()).toEqual([
			"README.md",
			"bad.md",
			"test.md",
		]);
	});
});
