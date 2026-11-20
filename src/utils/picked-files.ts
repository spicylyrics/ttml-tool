import { AUDIO_EXTENSIONS } from "./audio-formats";
import { LYRIC_FILE_EXTENSIONS } from "./lyric-formats";

export const extensionOf = (file: File) =>
	file.name.split(".").pop()?.toLowerCase() ?? "";

/**
 * Splits picked or dropped files into one lyric file and one audio file.
 * A file we can read as lyrics wins over other non-audio files, which only
 * stand in as the lyric file (to be refused with a message) when there is no
 * real one. Anything past the first of each kind is counted as left out.
 */
export function sortPickedFiles(files: File[]): {
	lyric?: File;
	audio?: File;
	ignored: number;
} {
	const notAudio = files.filter(
		(file) => !AUDIO_EXTENSIONS.has(extensionOf(file)),
	);
	const lyric =
		notAudio.find((file) => LYRIC_FILE_EXTENSIONS.has(extensionOf(file))) ??
		notAudio[0];
	const audio = files.find((file) => AUDIO_EXTENSIONS.has(extensionOf(file)));
	return {
		lyric,
		audio,
		ignored: files.length - (lyric ? 1 : 0) - (audio ? 1 : 0),
	};
}
