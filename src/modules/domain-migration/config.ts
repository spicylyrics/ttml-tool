// Browser storage is per-origin, so one site hands its data to another through
// the pages in MigrationRouteApp. The stable site copies to the beta site. The
// env overrides exist for local two-origin tests.
export const OFFICIAL_TOOL_ORIGIN: string =
	import.meta.env.VITE_MIGRATION_OFFICIAL_ORIGIN ||
	"https://tool.spicylyrics.org";

export const BETA_TOOL_ORIGIN: string =
	import.meta.env.VITE_MIGRATION_BETA_ORIGIN ||
	"https://beta.tool.spicylyrics.org";

/** Set on the beta site once data has been copied there. */
export const BETA_COPY_COMPLETED_KEY = "betaDataCopied";
export const MIGRATION_PROTOCOL_VERSION = 2;
export const MIGRATION_CHUNK_SIZE = 1024 * 1024;

// Flat paths, so the page's relative asset URLs still resolve to /assets.
export const MIGRATION_SEND_PATH = "/migration-send";
export const MIGRATION_RECEIVE_PATH = "/migration-receive";

/**
 * A one-way copy. It never overwrites what the destination has, because both
 * sites stay in use.
 */
export interface TransferRoute {
	source: string;
	destination: string;
	/** Written on both ends when the transfer finishes. */
	completedKey: string;
}

/**
 * Every transfer allowed. API keys travel in the payload, so a site only ever
 * sends to, and accepts from, the origins listed here. Nothing in a URL can
 * change the destination.
 *
 * Beta to stable is left out on purpose: a project saved by a newer version
 * could replace stable's readable copy and delete its history, and settings
 * have no way back from a newer format.
 */
export const TRANSFER_ROUTES: readonly TransferRoute[] = [
	{
		source: OFFICIAL_TOOL_ORIGIN,
		destination: BETA_TOOL_ORIGIN,
		completedKey: BETA_COPY_COMPLETED_KEY,
	},
];

/** Where this origin sends its data, if anywhere. */
export const transferRouteFrom = (origin: string, isTauri = false) =>
	isTauri
		? undefined
		: TRANSFER_ROUTES.find((route) => route.source === origin);

/** The transfers this origin accepts. */
export const transferRoutesTo = (origin: string, isTauri = false) =>
	isTauri
		? []
		: TRANSFER_ROUTES.filter((route) => route.destination === origin);

export type MigrationHostKind = "official" | "beta" | "other";

export function classifyMigrationOrigin(
	origin: string,
	isTauri = false,
): MigrationHostKind {
	if (isTauri) return "other";
	if (origin === OFFICIAL_TOOL_ORIGIN) return "official";
	if (origin === BETA_TOOL_ORIGIN) return "beta";
	return "other";
}

export function isMigrationPath(pathname: string) {
	return (
		pathname === MIGRATION_SEND_PATH || pathname === MIGRATION_RECEIVE_PATH
	);
}

export function createMigrationNonce() {
	const bytes = crypto.getRandomValues(new Uint8Array(16));
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join(
		"",
	);
}
