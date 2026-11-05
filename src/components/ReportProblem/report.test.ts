import { describe, expect, it } from "vitest";
import {
	browserName,
	buildReport,
	issueUrl,
	type ReportInfo,
	redactSecrets,
} from "./report";

const info: ReportInfo = {
	version: "0.23.0-2",
	commit: "5a26c9eb1234",
	install: "nsis",
	os: "Windows 10.0.26100 (x86_64)",
	browser: null,
	design: true,
	language: "en-US",
	errors: [
		{ time: new Date(2026, 10, 3, 16, 20, 1), message: "TypeError: boom" },
	],
};

describe("problem reports", () => {
	it("lists the version, install and recent errors", () => {
		expect(buildReport("problem", info)).toBe(
			[
				"Spicy Lyrics TTML Tool 0.23.0 Beta 2, 5a26c9e",
				"App: Desktop, Windows installer (.exe)",
				"OS: Windows 10.0.26100 (x86_64)",
				"Design: Spicy Lyrics on",
				"Language: en-US",
				"",
				"Recent errors (newest last):",
				"  16:20:01 TypeError: boom",
			].join("\n"),
		);
	});

	it("leaves errors out of suggestions", () => {
		expect(buildReport("suggestion", info)).not.toContain("errors");
	});

	it("names the website and browser", () => {
		const report = buildReport("problem", {
			...info,
			install: "website",
			host: "tool.spicylyrics.org",
			browser: "Firefox 144",
			errors: [],
		});
		expect(report).toContain("App: Website (tool.spicylyrics.org)");
		expect(report).toContain("Browser: Firefox 144");
		expect(report).toContain("Recent errors: none");
	});

	it("hides keys, tokens, queries and home folder names", () => {
		const text = [
			"token abcdefgh12345 failed",
			"key sl_pk_live123 sent",
			"GET https://api.genius.com/search?q=x&access_token=y",
			"C:\\Users\\Alex\\Music\\a.ttml",
			"/home/alex/song.ttml and /Users/alex/x",
		].join("\n");
		const redacted = redactSecrets(text, ["abcdefgh12345", "short"]);
		expect(redacted).not.toMatch(
			/abcdefgh12345|live123|access_token|Alex|alex/,
		);
		expect(redacted).toContain("https://api.genius.com/search?[hidden]");
		expect(redacted).toContain("C:\\Users\\[hidden]\\Music");
	});

	it("reads common browsers", () => {
		expect(
			browserName(
				"Mozilla/5.0 (Windows NT 10.0) AppleWebKit/537.36 Chrome/141.0 Safari/537.36 Edg/141.0",
			),
		).toBe("Edge 141");
		expect(browserName("Mozilla/5.0 Gecko/20100101 Firefox/144.0")).toBe(
			"Firefox 144",
		);
		expect(
			browserName(
				"Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/18.1 Safari/605.1.15",
			),
		).toBe("Safari 18");
	});

	it("fills in the bug report form", () => {
		const url = new URL(issueUrl("problem", info, "details"));
		expect(url.pathname).toBe("/spicylyrics/ttml-tool/issues/new");
		expect(url.searchParams.get("template")).toBe("bug_report.yml");
		expect(url.searchParams.get("version")).toBe("0.23.0-2");
		expect(url.searchParams.get("diagnostics")).toBe("details");
		expect(
			new URL(issueUrl("suggestion", info, "x")).searchParams.get("template"),
		).toBe("feature_request.yml");
	});
});
