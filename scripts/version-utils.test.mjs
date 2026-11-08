import assert from "node:assert/strict";
import test from "node:test";
import {
	assertMatchingVersions,
	assertReleaseVersion,
	bumpVersion,
	compareVersions,
	isBetaVersion,
	readVersions,
	updateVersionSources,
} from "./version-utils.mjs";

const sources = {
	"package.json": '{\n\t"version": "0.7.7"\n}\n',
	"src-tauri/tauri.conf.json": '{\n\t"version": "0.7.7"\n}\n',
	"src-tauri/Cargo.toml":
		'[package]\nname = "amll-ttml-tool"\nversion = "0.7.7"\n\n[dependencies]\n',
	"src-tauri/Cargo.lock":
		'[[package]]\nname = "amll-ttml-tool"\nversion = "0.7.7"\ndependencies = []\n',
};

test("calculates stable SemVer bumps", () => {
	assert.equal(bumpVersion("0.7.7", "patch"), "0.7.8");
	assert.equal(bumpVersion("0.7.7", "minor"), "0.8.0");
	assert.equal(bumpVersion("0.7.7", "major"), "1.0.0");
});

test("rejects unsupported bump types and labelled prereleases", () => {
	assert.throws(() => bumpVersion("0.7.7", "tiny"), /patch, minor, or major/);
	assert.throws(() => bumpVersion("0.7.7-alpha.1", "patch"), /numbered beta/);
	assert.throws(() => assertReleaseVersion("0.7.7-beta.1"), /numbered beta/);
	assert.throws(() => assertReleaseVersion("0.7.7-0"), /numbered beta/);
	assert.throws(() => assertReleaseVersion("0.7.7-65536"), /65535/);
});

test("numbers betas and finishes them as stable", () => {
	assert.equal(bumpVersion("0.22.0", "beta", "minor"), "0.23.0-1");
	assert.equal(bumpVersion("0.22.0", "beta", "patch"), "0.22.1-1");
	assert.equal(bumpVersion("0.23.0-1", "beta"), "0.23.0-2");
	assert.equal(bumpVersion("0.23.0-3", "stable"), "0.23.0");
	assert.throws(() => bumpVersion("0.22.0", "beta"), /beta minor/);
	assert.throws(() => bumpVersion("0.23.0-1", "beta", "minor"), /alone/);
	assert.throws(() => bumpVersion("0.23.0-1", "patch"), /is a beta/);
	assert.throws(() => bumpVersion("0.23.0", "stable"), /already a stable/);
});

test("orders betas before their stable version", () => {
	const sorted = ["0.23.0", "0.23.0-10", "0.22.0", "0.23.1-1", "0.23.0-2"].sort(
		compareVersions,
	);
	assert.deepEqual(sorted, [
		"0.22.0",
		"0.23.0-2",
		"0.23.0-10",
		"0.23.0",
		"0.23.1-1",
	]);
	assert.equal(isBetaVersion("0.23.0-2"), true);
	assert.equal(isBetaVersion("0.23.0"), false);
});

test("updates every version source to a beta", () => {
	const updated = updateVersionSources(sources, "0.7.7", "0.8.0-1");
	assert.equal(assertMatchingVersions(readVersions(updated)), "0.8.0-1");
});

test("reads, checks, and updates every version source", () => {
	assert.equal(assertMatchingVersions(readVersions(sources)), "0.7.7");
	const updated = updateVersionSources(sources, "0.7.7", "0.8.0");
	assert.deepEqual(
		new Set(Object.values(readVersions(updated))),
		new Set(["0.8.0"]),
	);
});

test("rejects mismatched source versions", () => {
	const mismatched = {
		...sources,
		"src-tauri/tauri.conf.json": '{"version":"0.7.6"}',
	};
	assert.throws(
		() => assertMatchingVersions(readVersions(mismatched)),
		/Version files do not match/,
	);
});
