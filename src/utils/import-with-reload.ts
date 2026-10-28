import i18n from "i18next";
import { toast } from "react-toastify";

const RELOAD_KEY = "last-lazy-reload";
const RELOAD_WINDOW_MS = 10000;

/** A dynamic import that failed because the chunk is gone or unreachable. */
export function isChunkLoadError(error: unknown): boolean {
	if (!(error instanceof Error)) return false;
	return (
		error instanceof TypeError ||
		error.name === "ChunkLoadError" ||
		/failed to fetch/i.test(error.message) ||
		/loading chunk/i.test(error.message)
	);
}

/**
 * Runs a dynamic import. If the chunk can't be loaded (usually because a new
 * version was deployed and the old asset hashes are gone), reloads the page
 * once to pick up the new version. If it already reloaded in the last few
 * seconds, shows the error toast instead of looping. Always rethrows.
 */
export async function importWithReload<T>(
	factory: () => Promise<T>,
): Promise<T> {
	try {
		return await factory();
	} catch (error) {
		if (isChunkLoadError(error)) {
			console.error(
				"Dynamic import failed. Forcing page refresh to get latest version.",
				error,
			);
			let lastReload: string | null = null;
			try {
				lastReload = sessionStorage.getItem(RELOAD_KEY);
			} catch {}
			const now = Date.now();
			if (!lastReload || now - Number(lastReload) > RELOAD_WINDOW_MS) {
				try {
					sessionStorage.setItem(RELOAD_KEY, String(now));
				} catch {}
				window.location.reload();
			} else {
				toast.error(i18n.t("app.error.tryRestart", "Try reloading the app"));
			}
		}
		throw error;
	}
}
