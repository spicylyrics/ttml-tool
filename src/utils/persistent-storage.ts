const isWebsite = !import.meta.env.TAURI_ENV_PLATFORM;

let requested = false;

/**
 * Ask the browser to keep the website's saved projects. Without this, browsers
 * may clear the site's storage when disk space runs low or the site goes
 * unused for a while. Asked once per page load, when there is a project to
 * keep, since Firefox shows a prompt for it.
 */
export async function requestPersistentStorage() {
	if (!isWebsite || requested || !navigator.storage?.persist) return;
	requested = true;
	try {
		if (!(await navigator.storage.persisted()))
			await navigator.storage.persist();
	} catch {
		// Not supported or refused: storage stays best-effort.
	}
}
