import semverGt from "semver/functions/gt";
import semverValid from "semver/functions/valid";

/** localStorage key holding the newest app version this browser has run. */
export const LAST_SEEN_VERSION_KEY = "lastSeenAppVersion";

export interface UpdatedToastDecision {
	/** Show "Updated to vX.Y.Z" for the current version. */
	show: boolean;
	/** Version to write back as last seen, or null to leave storage alone. */
	store: string | null;
}

/**
 * Decide whether this start is the first one on a newer version.
 *
 * - No stored version (first run, or storage was cleared): store silently.
 * - Stored version is not valid semver: store silently, so a bad value
 *   never turns into a toast.
 * - Current is newer than stored: show once and store it.
 * - Same or older (a downgrade): do nothing. Keeping the higher version
 *   means going back and forth never repeats a toast for the same release.
 */
export function decideUpdatedToast(
	currentVersion: string,
	lastSeenVersion: string | null,
): UpdatedToastDecision {
	const current = semverValid(currentVersion);
	if (!current) return { show: false, store: null };

	const lastSeen = lastSeenVersion ? semverValid(lastSeenVersion) : null;
	if (!lastSeen) return { show: false, store: current };

	if (semverGt(current, lastSeen)) return { show: true, store: current };

	return { show: false, store: null };
}
