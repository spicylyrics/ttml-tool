import { readFileSync } from "node:fs";
import { join } from "node:path";

export const VERSION_FILES = [
	"package.json",
	"src-tauri/tauri.conf.json",
	"src-tauri/Cargo.toml",
	"src-tauri/Cargo.lock",
];

const STABLE_SEMVER = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/;
// Betas are X.Y.Z-N: a plain number, since the MSI build only takes a numeric
// pre-release, and at most 65535.
const RELEASE_SEMVER =
	/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([1-9]\d{0,4}))?$/;
const BETA_MAX = 65535;

export function assertStableVersion(version, label = "Version") {
	if (!STABLE_SEMVER.test(version)) {
		throw new Error(`${label} ${version} must use stable SemVer (X.Y.Z).`);
	}
	return version;
}

/** A stable X.Y.Z or a numbered beta X.Y.Z-N. */
export function assertReleaseVersion(version, label = "Version") {
	const match = RELEASE_SEMVER.exec(version ?? "");
	if (!match || (match[4] && Number(match[4]) > BETA_MAX)) {
		throw new Error(
			`${label} ${version} must be SemVer X.Y.Z or a numbered beta X.Y.Z-N (N from 1 to ${BETA_MAX}).`,
		);
	}
	return version;
}

/** { base: "0.23.0", beta: 2 } for 0.23.0-2, beta null for a stable version. */
export function parseReleaseVersion(version) {
	const [, major, minor, patch, beta] = RELEASE_SEMVER.exec(
		assertReleaseVersion(version),
	);
	return {
		base: `${major}.${minor}.${patch}`,
		parts: [major, minor, patch].map(Number),
		beta: beta ? Number(beta) : null,
	};
}

export const isBetaVersion = (version) =>
	parseReleaseVersion(version).beta !== null;

/** SemVer order: 0.23.0-1 < 0.23.0-2 < 0.23.0 < 0.23.1-1. */
export function compareVersions(a, b) {
	const left = parseReleaseVersion(a);
	const right = parseReleaseVersion(b);
	for (let i = 0; i < 3; i++) {
		if (left.parts[i] !== right.parts[i]) return left.parts[i] - right.parts[i];
	}
	if (left.beta === right.beta) return 0;
	if (left.beta === null) return 1;
	if (right.beta === null) return -1;
	return left.beta - right.beta;
}

/**
 * The next version: `patch`/`minor`/`major` from a stable version, `beta`
 * for the next beta (`beta minor` starts one from a stable version), and
 * `stable` to finish a beta cycle (0.23.0-3 -> 0.23.0).
 */
export function bumpVersion(version, type, betaOf) {
	const current = parseReleaseVersion(version);
	if (type === "beta") {
		if (current.beta !== null) {
			if (betaOf)
				throw new Error(
					`Already on a beta of ${current.base}; run "beta" alone for the next one.`,
				);
			if (current.beta >= BETA_MAX)
				throw new Error(`Beta numbers stop at ${BETA_MAX}.`);
			return `${current.base}-${current.beta + 1}`;
		}
		if (!betaOf)
			throw new Error('Say which version the beta is for: "beta minor".');
		return `${bumpVersion(version, betaOf)}-1`;
	}
	if (type === "stable") {
		if (current.beta === null)
			throw new Error(`${version} is already a stable version.`);
		return current.base;
	}
	if (current.beta !== null)
		throw new Error(
			`${version} is a beta; use "beta" for the next beta or "stable" to release ${current.base}.`,
		);
	const match = version.match(STABLE_SEMVER);
	const [, majorText, minorText, patchText] = match;
	let major = Number(majorText);
	let minor = Number(minorText);
	let patch = Number(patchText);

	switch (type) {
		case "patch":
			patch += 1;
			break;
		case "minor":
			minor += 1;
			patch = 0;
			break;
		case "major":
			major += 1;
			minor = 0;
			patch = 0;
			break;
		default:
			throw new Error("Bump type must be patch, minor, or major.");
	}

	return `${major}.${minor}.${patch}`;
}

function readJsonVersion(source, file) {
	try {
		return JSON.parse(source).version;
	} catch (error) {
		throw new Error(`Could not read ${file}: ${error.message}`);
	}
}

function readCargoPackageVersion(source, file) {
	const packageSection = source.match(
		/^\[package\]\s*$([\s\S]*?)(?=^\[|(?![\s\S]))/m,
	)?.[1];
	const version = packageSection?.match(/^version = "([^"]+)"$/m)?.[1];
	if (!version)
		throw new Error(`Could not find the package version in ${file}.`);
	return version;
}

function readCargoLockVersion(source, file) {
	const escapedName = "amll-ttml-tool".replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	const packageEntry = source.match(
		new RegExp(
			`^\\[\\[package\\]\\]\\s*\\r?\\nname = "${escapedName}"\\s*\\r?\\nversion = "([^"]+)"`,
			"m",
		),
	);
	if (!packageEntry)
		throw new Error(`Could not find the app package in ${file}.`);
	return packageEntry[1];
}

export function readVersions(sources) {
	return {
		"package.json": readJsonVersion(sources["package.json"], "package.json"),
		"src-tauri/tauri.conf.json": readJsonVersion(
			sources["src-tauri/tauri.conf.json"],
			"src-tauri/tauri.conf.json",
		),
		"src-tauri/Cargo.toml": readCargoPackageVersion(
			sources["src-tauri/Cargo.toml"],
			"src-tauri/Cargo.toml",
		),
		"src-tauri/Cargo.lock": readCargoLockVersion(
			sources["src-tauri/Cargo.lock"],
			"src-tauri/Cargo.lock",
		),
	};
}

export function assertMatchingVersions(versions) {
	const entries = Object.entries(versions);
	const expected = assertReleaseVersion(entries[0][1], entries[0][0]);
	const mismatches = entries.filter(([, version]) => version !== expected);
	if (mismatches.length > 0) {
		throw new Error(
			`Version files do not match:\n${entries.map(([file, version]) => `- ${file}: ${version}`).join("\n")}`,
		);
	}
	return expected;
}

export function loadVersionSources(root = process.cwd()) {
	return Object.fromEntries(
		VERSION_FILES.map((file) => [file, readFileSync(join(root, file), "utf8")]),
	);
}

function replaceOnce(source, pattern, replacement, file) {
	if (!pattern.test(source))
		throw new Error(`Could not update the version in ${file}.`);
	return source.replace(pattern, replacement);
}

export function updateVersionSources(sources, currentVersion, nextVersion) {
	assertReleaseVersion(nextVersion, "New version");
	const escapedCurrent = currentVersion.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
	return {
		...sources,
		"package.json": replaceOnce(
			sources["package.json"],
			new RegExp(`("version"\\s*:\\s*")${escapedCurrent}(")`),
			`$1${nextVersion}$2`,
			"package.json",
		),
		"src-tauri/tauri.conf.json": replaceOnce(
			sources["src-tauri/tauri.conf.json"],
			new RegExp(`("version"\\s*:\\s*")${escapedCurrent}(")`),
			`$1${nextVersion}$2`,
			"src-tauri/tauri.conf.json",
		),
		"src-tauri/Cargo.toml": replaceOnce(
			sources["src-tauri/Cargo.toml"],
			new RegExp(
				`(^\\[package\\]\\s*\\r?\\n(?:.*\\r?\\n)*?version = ")${escapedCurrent}(")`,
				"m",
			),
			`$1${nextVersion}$2`,
			"src-tauri/Cargo.toml",
		),
		"src-tauri/Cargo.lock": replaceOnce(
			sources["src-tauri/Cargo.lock"],
			new RegExp(
				`(^\\[\\[package\\]\\]\\s*\\r?\\nname = "amll-ttml-tool"\\s*\\r?\\nversion = ")${escapedCurrent}(")`,
				"m",
			),
			`$1${nextVersion}$2`,
			"src-tauri/Cargo.lock",
		),
	};
}
