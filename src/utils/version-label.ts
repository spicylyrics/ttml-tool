// Betas are numbered pre-releases of the next version: 0.23.0-2 is the second
// beta of 0.23.0, and 0.23.0 itself sorts above every one of them.

const VERSION = /^(\d+\.\d+\.\d+)(?:-(\d+))?$/;

export interface AppVersion {
	/** The version a beta leads up to, or the version itself. */
	base: string;
	/** The beta number, or null for a stable version. */
	beta: number | null;
}

export function parseAppVersion(version: string): AppVersion {
	const match = VERSION.exec(version.trim());
	if (!match) return { base: version, beta: null };
	return { base: match[1], beta: match[2] ? Number(match[2]) : null };
}

export const isBetaVersion = (version: string) =>
	parseAppVersion(version).beta !== null;

type Translate = (
	key: "aboutModal.betaVersion",
	fallback: string,
	values: { version: string; number: number },
) => string;

/** "0.23.0 Beta 2", translated, for the UI. */
export function translatedVersionLabel(version: string, t: Translate) {
	const { base, beta } = parseAppVersion(version);
	return beta === null
		? base
		: t("aboutModal.betaVersion", "{version} Beta {number}", {
				version: base,
				number: beta,
			});
}

/** "0.23.0 Beta 2" in English, for reports; the UI uses the translated label. */
export function versionLabel(version: string) {
	const { base, beta } = parseAppVersion(version);
	return beta === null ? base : `${base} Beta ${beta}`;
}
