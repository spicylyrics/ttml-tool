import { AUDIO_EXTENSIONS } from "./audio-formats";

export const extensionOf = (file: File) =>
	file.name.split(".").pop()?.toLowerCase() ?? "";

/**
 * Splits picked or dropped files into one lyric file and one audio file.
 * Anything past the first of each kind is counted as left out.
 */
export function sortPickedFiles(files: File[]): {
	lyric?: File;
	audio?: File;
	ignored: number;
} {
	const lyric = files.find((file) => !AUDIO_EXTENSIONS.has(extensionOf(file)));
	const audio = files.find((file) => AUDIO_EXTENSIONS.has(extensionOf(file)));
	return {
		lyric,
		audio,
		ignored: files.length - (lyric ? 1 : 0) - (audio ? 1 : 0),
	};
}
