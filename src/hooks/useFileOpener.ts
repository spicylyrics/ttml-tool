/**
 * @description 处理打开文件的逻辑
 */

import {
	type LyricLine,
	parseEslrc,
	parseLys,
	parseQrc,
	parseYrc,
} from "@applemusic-like-lyrics/lyric";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";
import { lineSyncEnabledAtom } from "$/modules/line-sync/states";
import { applyLrcTimingMode } from "$/modules/line-sync/timing-mode";
import { sectionEditingEnabledAtom } from "$/modules/lyric-editor/states/section-editing";
import { getProjectList } from "$/modules/project/autosave/autosave";
import { maybePromptCreateProject } from "$/modules/project/folder-project/project-create";
import { pendingLyricSourceAtom } from "$/modules/project/folder-project/state";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import { isProjectMatch } from "$/modules/project/logic/project-match";
import { parseLyric as parseTTML } from "$/modules/project/logic/ttml-parser";
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
import { AUDIO_EXTENSIONS } from "$/utils/audio-formats";
import { log, error as logError } from "$/utils/logging";
import { parseLrc } from "$/utils/parse-lrc";
import { getDialogPath } from "./load-audio";
import { useLoadAudio } from "./useLoadAudio";

const LYRIC_PARSERS: Record<string, (text: string) => LyricLine[]> = {
	lrc: parseLrc,
	eslrc: parseEslrc,
	qrc: parseQrc,
	yrc: parseYrc,
	lys: parseLys,
};

export const useFileOpener = () => {
	const store = useStore();
	const { openAudioFile } = useLoadAudio();
	const setNewLyricLines = useSetAtom(newLyricLinesAtom);
	const setProjectId = useSetAtom(projectIdAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const { t } = useTranslation();

	const normalizeApostrophesOnImport = useAtomValue(
		normalizeApostrophesOnImportAtom,
	);
	const normalizeCyrillicEsOnImport = useAtomValue(
		normalizeCyrillicEsOnImportAtom,
	);

	const normalizeLyricLines = useCallback(
		(lyricLines: LyricLine[]): TTMLLyric => {
			return {
				lyricLines: lyricLines.map((line) => ({
					...line,
					words: line.words.map((word) => ({
						...word,
						id: uid(),
						obscene: false,
					})),
					ignoreSync: false,
					id: uid(),
				})),
				metadata: [],
			};
		},
		[],
	);

	const performOpenFileInner = useCallback(
		async (file: File, forceExt?: string) => {
			const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
			const ext = forceExt ? forceExt.toLowerCase() : rawExt;

			try {
				let lyricData: TTMLLyric | null = null;
				const text = await file.text();

				if (ext === "ttml") {
					lyricData = parseTTML(text, {
						readSongParts: store.get(sectionEditingEnabledAtom),
					});
				} else if (ext in LYRIC_PARSERS) {
					const parser = LYRIC_PARSERS[ext];
					const rawLines = parser(text);
					lyricData = normalizeLyricLines(rawLines);
					if (ext === "lrc")
						lyricData = applyLrcTimingMode(
							lyricData,
							store.get(lineSyncEnabledAtom),
						);
				} else {
					toast.error(
						t("error.unsupportedFileFormat", "不支持的文件格式: {ext}", {
							ext,
						}),
					);
					return;
				}

				if (!lyricData) return;
				lyricData = normalizeImportedLyricApostrophes(
					lyricData,
					normalizeApostrophesOnImport,
				);
				lyricData = normalizeImportedLyricCyrillicEs(
					lyricData,
					normalizeCyrillicEsOnImport,
				);

				let resolvedProjectId = uid();

				try {
					if (lyricData.metadata.length > 0) {
						const projects = await getProjectList();
						const matchedProject = projects.find((p) =>
							isProjectMatch(p, lyricData as TTMLLyric),
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
		[
			setNewLyricLines,
			setProjectId,
			setSaveFileName,
			normalizeLyricLines,
			t,
			normalizeApostrophesOnImport,
			normalizeCyrillicEsOnImport,
			store,
		],
	);

	const openFile = useCallback(
		/**
		 * 打开文件
		 * @param file
		 * @param forceExt 可选参数，用于强制指定解析方式，不传入则从文件后缀名推断
		 */
		(file: File, forceExt?: string) => {
			const run = () => performOpenFileInner(file, forceExt);

			const rawExt = file.name.split(".").pop()?.toLowerCase() || "";
			const finalExt = forceExt?.toLowerCase() || rawExt;

			if (AUDIO_EXTENSIONS.has(finalExt)) {
				void openAudioFile(file, forceExt);
				return;
			}

			if (isDirty) {
				setConfirmDialog({
					open: true,
					title: t("confirmDialog.openFile.title", "Open another file?"),
					description: t(
						"confirmDialog.openFile.description",
						"当前文件有未保存的更改。如果继续，这些更改将会丢失。确定要打开新文件吗？",
					),
					onConfirm: run,
				});
			} else {
				run();
			}
		},
		[isDirty, setConfirmDialog, t, performOpenFileInner, openAudioFile],
	);

	return { openFile };
};
