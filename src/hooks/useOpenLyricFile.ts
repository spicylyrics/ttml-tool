/**
 * Opening a lyric file: parse it, match it to a saved project, and replace
 * the current lyrics, asking first when there are unsaved changes. A file
 * that holds no lyrics is refused before anything is asked or replaced.
 * Audio goes through useLoadAudio, and useFileOpener routes a pick to either.
 */

import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";
import { getProjectList } from "$/modules/project/autosave/autosave";
import { maybePromptCreateProject } from "$/modules/project/folder-project/project-create";
import { pendingLyricSourceAtom } from "$/modules/project/folder-project/state";
import { parseLyricFile } from "$/modules/project/logic/lyric-file-open";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import { isProjectMatch } from "$/modules/project/logic/project-match";
import {
	normalizeApostrophesOnImportAtom,
	normalizeCyrillicEsOnImportAtom,
} from "$/modules/settings/states";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	startFreshLyricDocumentAtom,
} from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import {
	normalizeImportedLyricApostrophes,
	normalizeImportedLyricCyrillicEs,
} from "$/utils/apostrophe-normalization";
import { log, error as logError } from "$/utils/logging";
import { getDialogPath } from "./load-audio";

const extensionFor = (file: File, forceExt?: string) =>
	(forceExt || file.name.split(".").pop() || "").toLowerCase();

export const useOpenLyricFile = () => {
	const store = useStore();
	const setNewLyricLines = useSetAtom(newLyricLinesAtom);
	const setProjectId = useSetAtom(projectIdAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const { t } = useTranslation();

	const normalizeApostrophesOnImport = useAtomValue(
		normalizeApostrophesOnImportAtom,
	);
	const normalizeCyrillicEsOnImport = useAtomValue(
		normalizeCyrillicEsOnImportAtom,
	);

	/** Reads and checks the file. Null (with a toast) when it can't be opened. */
	const readLyricFile = useCallback(
		async (file: File, ext: string): Promise<TTMLLyric | null> => {
			try {
				const parsed = parseLyricFile(await file.text(), ext);
				if (parsed.kind === "unsupported") {
					toast.error(
						t("error.unsupportedFileFormat", "不支持的文件格式: {ext}", {
							ext,
						}),
					);
					return null;
				}
				if (parsed.kind === "empty") {
					toast.error(
						t("error.noLyricsInFile", "No lyrics found in {name}", {
							name: file.name,
						}),
					);
					return null;
				}
				return normalizeImportedLyricCyrillicEs(
					normalizeImportedLyricApostrophes(
						parsed.lyric,
						normalizeApostrophesOnImport,
					),
					normalizeCyrillicEsOnImport,
				);
			} catch (e) {
				logError(`Failed to open file: ${file.name}`, e);
				toast.error(t("error.openFileFailed", "打开文件失败"));
				return null;
			}
		},
		[t, normalizeApostrophesOnImport, normalizeCyrillicEsOnImport],
	);

	/** Replaces the open document with a file that already passed the checks. */
	const applyLyricFile = useCallback(
		async (file: File, ext: string, lyricData: TTMLLyric) => {
			try {
				let resolvedProjectId = uid();

				try {
					if (lyricData.metadata.length > 0) {
						const projects = await getProjectList();
						const matchedProject = projects.find((p) =>
							isProjectMatch(p, lyricData),
						);

						if (matchedProject) {
							log(
								`匹配到了已有项目: ${matchedProject.name} (${matchedProject.id})`,
							);
							resolvedProjectId = matchedProject.id;
						} else {
							log("未匹配已有项目");
						}
					}
				} catch (e) {
					logError("解析项目数据时失败", e);
				}

				setProjectId(resolvedProjectId);
				setNewLyricLines(lyricData);
				store.set(startFreshLyricDocumentAtom);
				const suggestedFile = getSuggestedTtmlFileName(lyricData.metadata);
				const nextFileName =
					ext === "ttml" ? file.name : (suggestedFile?.fileName ?? file.name);
				setSaveFileName(nextFileName);
				const lyricPath = ext === "ttml" ? getDialogPath(file) : null;
				store.set(
					pendingLyricSourceAtom,
					lyricPath
						? {
								path: lyricPath,
								lineIds: lyricData.lyricLines.map((line) => line.id),
							}
						: null,
				);
				maybePromptCreateProject(store);
			} catch (e) {
				logError(`Failed to open file: ${file.name}`, e);
				toast.error(t("error.openFileFailed", "打开文件失败"));
			}
		},
		[setNewLyricLines, setProjectId, setSaveFileName, t, store],
	);

	const openLyricFile = useCallback(
		/**
		 * @param forceExt parse as this format instead of the file's extension
		 * @param afterOpen runs once the lyrics are open, or when the file was
		 *   refused, but not when the user keeps their unsaved changes
		 */
		(file: File, forceExt?: string, afterOpen?: () => void) => {
			const run = async () => {
				const ext = extensionFor(file, forceExt);
				const lyricData = await readLyricFile(file, ext);
				if (!lyricData) {
					afterOpen?.();
					return;
				}

				const open = async () => {
					await applyLyricFile(file, ext, lyricData);
					afterOpen?.();
				};

				// Read at decision time: the file was awaited, so a render's copy may be stale.
				if (store.get(isDirtyAtom)) {
					setConfirmDialog({
						open: true,
						title: t("confirmDialog.openFile.title", "Open another file?"),
						description: t(
							"confirmDialog.openFile.description",
							"当前文件有未保存的更改。如果继续，这些更改将会丢失。确定要打开新文件吗？",
						),
						onConfirm: () => void open(),
					});
				} else {
					await open();
				}
			};
			void run();
		},
		[store, setConfirmDialog, t, readLyricFile, applyLyricFile],
	);

	return { openLyricFile };
};
