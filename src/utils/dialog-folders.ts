/**
 * Each place that opens a file or folder dialog remembers the folder it was
 * last used in, so Load audio starts in your music folder and Open starts
 * where your lyrics are. Desktop only: browsers don't let a page pick the
 * folder a file dialog opens in.
 */
export type DialogPlace =
	| "openFile"
	| "loadAudio"
	| "timeStretchAudio"
	| "workspace"
	| "projectParent"
	| "linkAudio"
	| "linkLyrics";

const STORAGE_KEY = "fileDialog.lastFolders";

function readAll(): Partial<Record<DialogPlace, string>> {
	try {
		const parsed = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "{}");
		return parsed && typeof parsed === "object" ? parsed : {};
	} catch {
		return {};
	}
}

/** The folder a path is in: `C:\Music\song.mp3` → `C:\Music`. */
export function folderOf(path: string): string {
	const cut = Math.max(path.lastIndexOf("/"), path.lastIndexOf("\\"));
	if (cut < 0) return path;
	// Keep a root's separator: "/song.mp3" → "/", "C:\song.mp3" → "C:\".
	return cut === 0 || path[cut - 1] === ":"
		? path.slice(0, cut + 1)
		: path.slice(0, cut);
}

/** Where this place's dialog should open, if it has been used before. */
export function lastFolder(place: DialogPlace): string | undefined {
	const folder = readAll()[place];
	return typeof folder === "string" && folder ? folder : undefined;
}

/**
 * Remembers where a dialog's pick came from. A file's folder is kept; for a
 * folder pick, its parent is, so the next dialog shows it among its siblings.
 */
export function rememberPick(
	place: DialogPlace,
	picked: string | string[] | null | undefined,
): void {
	const first = Array.isArray(picked) ? picked[0] : picked;
	if (!first) return;
	try {
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ ...readAll(), [place]: folderOf(first) }),
		);
	} catch {
		// Storage can be full or blocked; the dialog just opens where it would.
	}
}

/** A save dialog's start: the remembered folder with the suggested name. */
export function savePathFor(
	place: DialogPlace,
	fileName: string,
): string | undefined {
	const folder = lastFolder(place);
	if (!folder) return fileName;
	const separator = folder.includes("\\") ? "\\" : "/";
	return folder.endsWith(separator)
		? `${folder}${fileName}`
		: `${folder}${separator}${fileName}`;
}
