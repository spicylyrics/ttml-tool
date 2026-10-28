/** A `.ttml` and an audio file in the same folder with the same base name. */
export interface LinkablePair {
	/** Base name shared by both files, as written on the TTML. */
	name: string;
	lyricFile: string;
	audioFile: string;
}

/** Audio picked first when one TTML has several same-name audio files. Lossless first. */
const AUDIO_PREFERENCE = ["flac", "wav", "m4a", "ogg", "opus", "mp3", "webm"];

const splitName = (fileName: string) => {
	const dot = fileName.lastIndexOf(".");
	if (dot <= 0) return { base: fileName, ext: "" };
	return {
		base: fileName.slice(0, dot),
		ext: fileName.slice(dot + 1).toLowerCase(),
	};
};

const baseKey = (base: string) => base.normalize("NFC").trim().toLowerCase();

const audioRank = (ext: string) => {
	const index = AUDIO_PREFERENCE.indexOf(ext);
	return index === -1 ? AUDIO_PREFERENCE.length : index;
};

/**
 * Pairs each `.ttml` with an audio file of the same base name (case-insensitive).
 * A base name with more than one TTML is skipped: there's no safe guess.
 */
export function findLinkablePairs(
	fileNames: readonly string[],
	audioExtensions: ReadonlySet<string>,
): LinkablePair[] {
	const lyrics = new Map<string, string[]>();
	const audio = new Map<string, string[]>();
	for (const fileName of fileNames) {
		const { base, ext } = splitName(fileName);
		if (!base || base.startsWith(".")) continue;
		const key = baseKey(base);
		if (ext === "ttml") lyrics.set(key, [...(lyrics.get(key) ?? []), fileName]);
		else if (audioExtensions.has(ext))
			audio.set(key, [...(audio.get(key) ?? []), fileName]);
	}
	const pairs: LinkablePair[] = [];
	for (const [key, lyricFiles] of lyrics) {
		const audioFiles = audio.get(key);
		if (lyricFiles.length !== 1 || !audioFiles?.length) continue;
		const [audioFile] = [...audioFiles].sort(
			(a, b) =>
				audioRank(splitName(a).ext) - audioRank(splitName(b).ext) ||
				a.localeCompare(b),
		);
		pairs.push({
			name: splitName(lyricFiles[0]).base.trim(),
			lyricFile: lyricFiles[0],
			audioFile,
		});
	}
	return pairs.sort((a, b) => a.name.localeCompare(b.name));
}

/** Path comparison that ignores slash direction, a trailing slash and (for Windows) case. */
export const pathKey = (path: string) =>
	path.replace(/\\/g, "/").replace(/\/+$/, "").toLowerCase();

/** Drops pairs whose TTML is already a linked project's file. */
export function withoutLinkedPaths<T extends { lyricPath: string }>(
	pairs: readonly T[],
	linkedLyricPaths: Iterable<string>,
): T[] {
	const linked = new Set([...linkedLyricPaths].map(pathKey));
	return pairs.filter((pair) => !linked.has(pathKey(pair.lyricPath)));
}
