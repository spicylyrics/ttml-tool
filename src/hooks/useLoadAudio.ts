import { useStore } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { audioEngine } from "$/modules/audio/audio-engine";
import { maybePromptCreateProject } from "$/modules/project/folder-project/project-create";
import { AUDIO_EXTENSIONS } from "$/utils/audio-formats";
import type { DialogPlace } from "$/utils/dialog-folders";
import {
	LYRICS_AND_AUDIO_FILTERS,
	openFileWithDialog,
} from "$/utils/fileDialog";
import { error as logError } from "$/utils/logging";
import { extensionOf, sortPickedFiles } from "$/utils/picked-files";
import { loadAudioFile } from "./load-audio";
import { useOpenLyricFile } from "./useOpenLyricFile";

/** Audio buttons and file drops share validation, project state and errors. */
export function useLoadAudio() {
	const store = useStore();
	const { t } = useTranslation();
	const { openLyricFile } = useOpenLyricFile();
	const openAudioFile = useCallback(
		async (file: File, forceExt?: string) => {
			const ext = forceExt?.toLowerCase() ?? extensionOf(file);
			if (!AUDIO_EXTENSIONS.has(ext)) {
				toast.error(
					t("error.unsupportedFileFormat", "Unsupported file format: {ext}", {
						ext,
					}),
				);
				return;
			}
			try {
				const loaded = await loadAudioFile(store, file, (audio) =>
					audioEngine.loadMusic(audio),
				);
				if (loaded) maybePromptCreateProject(store);
			} catch (error) {
				logError(`Failed to load audio: ${file.name}`, error);
				toast.error(t("error.openFileFailed", "Failed to open file"));
			}
		},
		[store, t],
	);

	/**
	 * Opens what was picked or dropped: one lyric file, one audio file, or one
	 * of each. With both, the audio loads once the lyrics are open, so keeping
	 * unsaved changes cancels the pair.
	 */
	const openPickedFiles = useCallback(
		(files: File[]) => {
			const { lyric, audio, ignored } = sortPickedFiles(files);
			if (ignored > 0)
				toast.info(
					t(
						"dialog.openFilesIgnored",
						"{count, plural, one {# file was left out} other {# files were left out}}: open one lyric file and one audio file at a time.",
						{ count: ignored },
					),
				);
			if (lyric)
				openLyricFile(
					lyric,
					undefined,
					audio ? () => void openAudioFile(audio) : undefined,
				);
			else if (audio) void openAudioFile(audio);
		},
		[openLyricFile, openAudioFile, t],
	);

	/** Opens a file dialog that takes lyrics, audio or both. */
	const pickFiles = useCallback(
		async (place: DialogPlace) => {
			try {
				const picked = await openFileWithDialog({
					multiple: true,
					filters: LYRICS_AND_AUDIO_FILTERS,
					place,
				});
				if (!picked) return;
				openPickedFiles(Array.isArray(picked) ? picked : [picked]);
			} catch (error) {
				logError("Failed to pick files", error);
				toast.error(t("error.openFileFailed", "Failed to open file"));
			}
		},
		[openPickedFiles, t],
	);

	const loadAudio = useCallback(() => pickFiles("loadAudio"), [pickFiles]);
	return { loadAudio, openAudioFile, openPickedFiles, pickFiles };
}
