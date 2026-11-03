// The text a problem report or suggestion carries, and the GitHub issue link
// that fills it in. English on purpose: it's read by the maintainers.

import type { LoggedError } from "$/utils/errorLog";
import { versionLabel } from "$/utils/version-label";

export type ReportKind = "problem" | "suggestion";

export type InstallKind =
	| "website"
	| "nsis"
	| "msi"
	| "app"
	| "flatpak"
	| "appimage"
	| "deb"
	| "rpm"
	| "aur"
	| "unknown";

export interface ReportInfo {
	version: string;
	commit: string;
	install: InstallKind;
	/** The website's host, shown instead of a package. */
	host?: string;
	/** "Windows 10.0.26100 (x86_64)" on desktop, just the name on the website. */
	os: string;
	browser: string | null;
	design: boolean;
	language: string;
	errors: readonly LoggedError[];
}

export const REPOSITORY = "https://github.com/spicylyrics/ttml-tool";
export const DISCORD_FORUM_URL =
	"https://discord.com/channels/1369992682214264993/1558259984318603334";

// GitHub links much longer than this get cut off or refused.
export const MAX_ISSUE_URL = 7000;

const INSTALL_LABELS: Record<InstallKind, string> = {
	website: "Website",
	nsis: "Windows installer (.exe)",
	msi: "Windows installer (.msi)",
	app: "macOS app",
	flatpak: "Flatpak",
	appimage: "AppImage",
	deb: ".deb package",
	rpm: ".rpm package",
	aur: "AUR package",
	unknown: "Unknown package",
};

/** "Chrome 141", from a user agent string. */
export function browserName(userAgent: string): string {
	const known: [string, RegExp][] = [
		["Edge", /Edg\/(\d+)/],
		["Opera", /OPR\/(\d+)/],
		["Firefox", /Firefox\/(\d+)/],
		["Chrome", /Chrome\/(\d+)/],
		["Safari", /Version\/(\d+)[\d.]* Safari/],
	];
	for (const [name, pattern] of known) {
		const match = pattern.exec(userAgent);
		if (match) return `${name} ${match[1]}`;
	}
	return "Unknown browser";
}

/** Blanks keys, tokens, URL queries and the user's name in home folders. */
export function redactSecrets(text: string, secrets: readonly string[] = []) {
	let result = text;
	for (const secret of secrets) {
		if (secret.trim().length >= 8)
			result = result.split(secret).join("[hidden]");
	}
	return result
		.replace(/\bsl_(pk|sk)_[A-Za-z0-9_-]+/g, "sl_$1_[hidden]")
		.replace(/(https?:\/\/[^\s?#]+)\?[^\s#]*/g, "$1?[hidden]")
		.replace(/([A-Za-z]:[\\/]+Users[\\/]+)[^\\/\s]+/gi, "$1[hidden]")
		.replace(/(\/(?:home|Users)\/)[^/\s]+/g, "$1[hidden]");
}

const two = (value: number) => String(value).padStart(2, "0");
const clock = (time: Date) =>
	`${two(time.getHours())}:${two(time.getMinutes())}:${two(time.getSeconds())}`;

export function buildReport(
	kind: ReportKind,
	info: ReportInfo,
	{ includeErrors = true } = {},
) {
	const commit =
		info.commit === "unknown" ? "" : `, ${info.commit.slice(0, 7)}`;
	const app =
		info.install === "website"
			? `Website${info.host ? ` (${info.host})` : ""}`
			: `Desktop, ${INSTALL_LABELS[info.install]}`;
	const lines = [
		`Spicy Lyrics TTML Tool ${versionLabel(info.version)}${commit}`,
		`App: ${app}`,
		`OS: ${info.os}`,
	];
	if (info.browser) lines.push(`Browser: ${info.browser}`);
	lines.push(
		`Design: Spicy Lyrics ${info.design ? "on" : "off"}`,
		`Language: ${info.language}`,
	);
	if (kind === "problem" && includeErrors) {
		lines.push("");
		if (info.errors.length === 0) {
			lines.push("Recent errors: none");
		} else {
			lines.push("Recent errors (newest last):");
			for (const error of info.errors)
				lines.push(`  ${clock(error.time)} ${error.message}`);
		}
	}
	return lines.join("\n");
}

/**
 * The GitHub issue form, with what the app knows filled in. GitHub only fills
 * text fields from the link, so the dropdowns are left to the reporter; the
 * details box names the app and OS anyway.
 */
export function issueUrl(kind: ReportKind, info: ReportInfo, details: string) {
	const params = new URLSearchParams();
	if (kind === "problem") {
		params.set("template", "bug_report.yml");
		params.set("version", info.version);
		if (info.browser) params.set("browser", info.browser);
	} else {
		params.set("template", "feature_request.yml");
	}
	params.set("diagnostics", details);
	return `${REPOSITORY}/issues/new?${params.toString()}`;
}
