import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { flattenStrings } from "./check-locales.mjs";

/**
 * Keys whose English text is correct in a translation as-is. A key listed
 * under "*" applies to every locale; add a locale code for words that only
 * one language borrows (e.g. "Album" in French).
 */
export const IDENTICAL_ALLOWLIST = {
	"*": [
		"aboutModal.appName",
		"importChooser.options.genius.title",
		"importChooser.options.lrclib.title",
		"latencyTestDialog.bpmInputLabel",
		"ribbonBar.previewMode.spicy",
		"ribbonBar.previewMode.standard",
		"settings.common.discordRichPresence",
		"topBar.appName",
		"topBar.menu.exportLyric.toESLRC",
		"topBar.menu.exportLyric.toLRC",
		"topBar.menu.exportLyric.toLrcfySylb",
		"topBar.menu.exportLyric.toQRC",
		"topBar.menu.exportLyric.toTTML",
		"topBar.menu.exportLyric.toYRC",
		"urbanDictionary.title",
	],
};

// Placeholders, tags and ICU syntax, which carry no translatable words.
const SYNTAX = /\{\{[^}]*\}\}|<\/?\d+>|\{\s*[\w.-]+\s*(?:,[^{}]*)?\}?|[{}#]/g;

/** True when a string has no words to translate, e.g. "{{count}}" or "%". */
export function hasNoWords(message) {
	return !/\p{L}/u.test(message.replace(SYNTAX, ""));
}

/**
 * Compare one catalog with en-US. A key counts as translated when it is
 * present, not blank (unless English is blank too) and either differs from
 * English, is allowlisted, or has no words to translate.
 */
export function localeCompleteness(
	source,
	target,
	locale,
	allowlist = IDENTICAL_ALLOWLIST,
) {
	const english = flattenStrings(source);
	const translated = flattenStrings(target);
	const allowed = new Set([
		...(allowlist["*"] ?? []),
		...(allowlist[locale] ?? []),
	]);
	const missing = [];
	const identical = [];
	let done = 0;
	for (const [key, value] of Object.entries(english)) {
		const text = translated[key];
		if (typeof text !== "string" || (value.trim() && !text.trim())) {
			missing.push(key);
		} else if (text === value && !allowed.has(key) && !hasNoWords(value)) {
			identical.push(key);
		} else {
			done++;
		}
	}
	const total = Object.keys(english).length;
	return {
		locale,
		total,
		translated: done,
		missing,
		identical,
		// Floor, so 100% always means nothing is left.
		percent: total ? Math.floor((done / total) * 1000) / 10 : 100,
	};
}

export function readCompleteness(root, allowlist = IDENTICAL_ALLOWLIST) {
	const read = (locale) =>
		JSON.parse(readFileSync(resolve(root, locale, "translation.json"), "utf8"));
	const source = read("en-US");
	return readdirSync(root, { withFileTypes: true })
		.filter((entry) => entry.isDirectory() && entry.name !== "en-US")
		.map((entry) =>
			localeCompleteness(source, read(entry.name), entry.name, allowlist),
		)
		.sort((a, b) => a.percent - b.percent || a.locale.localeCompare(b.locale));
}

export function formatTable(reports) {
	const rows = [
		["Locale", "Done", "Missing", "Same as English", "Complete"],
		...reports.map((report) => [
			report.locale,
			`${report.translated}/${report.total}`,
			String(report.missing.length),
			String(report.identical.length),
			`${report.percent.toFixed(1)}%`,
		]),
	];
	const widths = rows[0].map((_, column) =>
		Math.max(...rows.map((row) => row[column].length)),
	);
	return rows
		.map((row, index) =>
			row
				.map((cell, column) =>
					index > 0 && column > 0
						? cell.padStart(widths[column])
						: cell.padEnd(widths[column]),
				)
				.join("  ")
				.trimEnd(),
		)
		.join("\n");
}

if (
	process.argv[1] &&
	resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
	const args = process.argv.slice(2);
	const option = (name) => {
		const index = args.indexOf(name);
		return index < 0 ? undefined : args[index + 1];
	};
	const root = fileURLToPath(new URL("../src/i18n/locales", import.meta.url));
	let reports = readCompleteness(root);
	const only = option("--locale");
	if (only) reports = reports.filter((report) => report.locale === only);
	console.log(formatTable(reports));
	if (args.includes("--keys")) {
		for (const report of reports) {
			for (const key of report.missing)
				console.log(`${report.locale}: missing ${key}`);
			for (const key of report.identical)
				console.log(`${report.locale}: same as English ${key}`);
		}
	}
	const failUnder = option("--fail-under");
	if (failUnder !== undefined) {
		const below = reports.filter(
			(report) => report.percent < Number(failUnder),
		);
		if (below.length) {
			console.error(
				`Below ${failUnder}%: ${below.map((report) => report.locale).join(", ")}`,
			);
			process.exitCode = 1;
		}
	}
}
