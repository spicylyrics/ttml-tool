#!/usr/bin/env node
// Writes src/data/contributors.json: everyone with commits on main since the
// fork point, most commits first. Run during release prep (pnpm
// contributors:update) so the About tab needs no network request. Uses
// GITHUB_TOKEN when set (falls back to `gh auth token`), since the fork history
// takes several API pages.
import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const REPO = "spicylyrics/ttml-tool";
const FORK_POINT = "5d0e3387f013f4dbfdc0d0d6111bca8a74fd9449";
// Upstream authors and bots whose commits reach main through the fork history.
const EXCLUDED_IDS = new Set([39_523_898, 191_877_009, 55_551_133]);
const EXCLUDED_LOGINS = new Set(["invalid-email-address"]);

/** Counts commits per GitHub author, skipping unlinked and excluded authors. */
export function aggregateContributors(commits) {
	const byId = new Map();
	for (const { author } of commits) {
		if (
			typeof author?.id !== "number" ||
			typeof author.login !== "string" ||
			EXCLUDED_IDS.has(author.id) ||
			EXCLUDED_LOGINS.has(author.login.toLowerCase())
		) {
			continue;
		}
		const existing = byId.get(author.id);
		if (existing) existing.contributions++;
		else
			byId.set(author.id, {
				login: author.login,
				avatarUrl: author.avatar_url,
				profileUrl: author.html_url,
				contributions: 1,
			});
	}
	return [...byId.values()].sort(
		(a, b) =>
			b.contributions - a.contributions || a.login.localeCompare(b.login),
	);
}

function nextPage(link) {
	const next = link?.split(",").find((part) => part.includes('rel="next"'));
	return next?.match(/<([^>]+)>/)?.[1] ?? null;
}

function token() {
	if (process.env.GITHUB_TOKEN) return process.env.GITHUB_TOKEN;
	try {
		return execFileSync("gh", ["auth", "token"], { encoding: "utf8" }).trim();
	} catch {
		return "";
	}
}

async function main() {
	const auth = token();
	const commits = [];
	// dev, not main: releases are compiled before dev merges into main.
	let url = `https://api.github.com/repos/${REPO}/compare/${FORK_POINT}...dev?per_page=100`;
	while (url) {
		const response = await fetch(url, {
			headers: {
				Accept: "application/vnd.github+json",
				"X-GitHub-Api-Version": "2022-11-28",
				...(auth ? { Authorization: `Bearer ${auth}` } : {}),
			},
		});
		if (!response.ok)
			throw new Error(`GitHub compare failed: ${response.status}`);
		const body = await response.json();
		if (!Array.isArray(body.commits))
			throw new Error("GitHub compare response had no commit list");
		commits.push(...body.commits);
		url = nextPage(response.headers.get("link"));
	}
	const contributors = aggregateContributors(commits);
	const out = resolve(
		dirname(fileURLToPath(import.meta.url)),
		"../src/data/contributors.json",
	);
	mkdirSync(dirname(out), { recursive: true });
	writeFileSync(out, `${JSON.stringify(contributors, null, "\t")}\n`);
	console.log(
		`Wrote ${contributors.length} contributors from ${commits.length} commits`,
	);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
	main().catch((error) => {
		console.error(error.message);
		process.exit(1);
	});
}
