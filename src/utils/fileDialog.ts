import { open } from "@tauri-apps/plugin-dialog";
import { AUDIO_EXTENSIONS } from "./audio-formats";
import { type DialogPlace, lastFolder, rememberPick } from "./dialog-folders";

export interface OpenFileOptions {
	filters?: { name: string; extensions: string[] }[];
	multiple?: boolean;
	/** Which dialog this is, so it reopens in the folder it was last used in. */
	place?: DialogPlace;
}

export const LYRIC_FILE_FILTERS = [
	{ name: "TTML", extensions: ["ttml"] },
	{ name: "Lyrics", extensions: ["lrc", "eslrc", "qrc", "yrc", "lys"] },
];

const LYRIC_EXTENSIONS = LYRIC_FILE_FILTERS.flatMap((f) => f.extensions);

/**
 * Lyrics and audio together first, so both can be picked at once from any
 * open dialog, then each kind on its own.
 */
export const LYRICS_AND_AUDIO_FILTERS = [
	{
		name: "Lyrics and audio",
		extensions: [...LYRIC_EXTENSIONS, ...AUDIO_EXTENSIONS],
	},
	{ name: "Audio", extensions: [...AUDIO_EXTENSIONS] },
	{ name: "Lyrics", extensions: LYRIC_EXTENSIONS },
];

const MIME_TYPES: Record<string, string> = {
	ttml: "application/ttml+xml",
	mp3: "audio/mpeg",
	wav: "audio/wav",
	flac: "audio/flac",
	ogg: "audio/ogg",
};

/** A picked path as a File, with the path kept for linked projects. */
async function readPicked(path: string): Promise<File> {
	const { readFile } = await import("@tauri-apps/plugin-fs");
	const data = await readFile(path);
	const fileName = path.split(/[/\\]/).pop() || "unknown";
	const ext = fileName.split(".").pop()?.toLowerCase() ?? "";
	const type = MIME_TYPES[ext] ?? "application/octet-stream";
	const file = new File([new Blob([data], { type })], fileName, { type });
	(file as File & { path?: string }).path = path;
	return file;
}

export async function openFileWithDialog(
	options: OpenFileOptions,
): Promise<File | File[] | null> {
	if (import.meta.env.TAURI_ENV_PLATFORM) {
		const selected = await open({
			multiple: options.multiple,
			filters: options.filters,
			defaultPath: options.place ? lastFolder(options.place) : undefined,
		});
		if (!selected) return null;
		if (options.place) rememberPick(options.place, selected);

		try {
			return Array.isArray(selected)
				? await Promise.all(selected.map(readPicked))
				: await readPicked(selected);
		} catch (e) {
			alert(`File read error: ${String(e)}`);
			throw e;
		}
	}
	return new Promise((resolve) => {
		const inputEl = document.createElement("input");
		inputEl.type = "file";
		if (options.multiple) inputEl.multiple = true;
		if (options.filters) {
			const exts = options.filters.flatMap((f) =>
				f.extensions.map((e) => `.${e}`),
			);
			inputEl.accept = `${exts.join(",")},*/*`;
		}
		inputEl.addEventListener(
			"change",
			() => {
				const files = Array.from(inputEl.files || []);
				if (files.length === 0) resolve(null);
				else if (options.multiple) resolve(files);
				else resolve(files[0]);
			},
			{ once: true },
		);
		inputEl.click();
	});
}
