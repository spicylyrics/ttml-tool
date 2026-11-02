import { useCallback } from "react";
import { AUDIO_EXTENSIONS } from "$/utils/audio-formats";
import { useLoadAudio } from "./useLoadAudio";
import { useOpenLyricFile } from "./useOpenLyricFile";

/**
 * Opens any file the app understands: audio goes to the player, everything
 * else is read as lyrics. `openFiles` takes several at once (a pick or a
 * drop) and opens one lyric file and one audio file from them.
 */
export const useFileOpener = () => {
	const { openAudioFile, openPickedFiles } = useLoadAudio();
	const { openLyricFile } = useOpenLyricFile();

	const openFile = useCallback(
		/** @param forceExt parse as this format instead of the file's extension */
		(file: File, forceExt?: string) => {
			const ext =
				forceExt?.toLowerCase() ||
				file.name.split(".").pop()?.toLowerCase() ||
				"";
			if (AUDIO_EXTENSIONS.has(ext)) void openAudioFile(file, forceExt);
			else openLyricFile(file, forceExt);
		},
		[openAudioFile, openLyricFile],
	);

	return { openFile, openFiles: openPickedFiles };
};
