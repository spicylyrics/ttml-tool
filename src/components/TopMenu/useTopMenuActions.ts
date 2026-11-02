import { open } from "@tauri-apps/plugin-shell";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom, withImmer } from "jotai-immer";
import { useCallback, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";
import { useFileOpener } from "$/hooks/useFileOpener.ts";
import { useLoadAudio } from "$/hooks/useLoadAudio.ts";
import { deleteWordsFromLines } from "$/modules/lyric-editor/utils/normalize-line-time";
import { getGuideUrl } from "$/modules/onboarding/logic";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	projectAudioFileAtom,
} from "$/modules/project/folder-project/state";
import {
	copyTTML,
	type ExportTranslation,
	saveTTML,
} from "$/modules/project/ttml-save";
import {
	segmentationEngineAtom,
	segmentationSplitEnglishAtom,
} from "$/modules/segmentation/states";
import { matchesSavedSyllabificationEngine } from "$/modules/segmentation/utils/detect-syllabification-engine";
import { segmentLyricLines } from "$/modules/segmentation/utils/segmentation";
import { SYLLABIFICATION_ENGINES } from "$/modules/segmentation/utils/syllabification-engines";
import { useSegmentationConfig } from "$/modules/segmentation/utils/useSegmentationConfig";
import {
	advancedSegmentationDialogAtom,
	autoSegmentDialogAtom,
	confirmDialogAtom,
	historyRestoreDialogAtom,
	latencyTestDialogAtom,
	learnedSplitsDialogAtom,
	metadataEditorDialogAtom,
	projectsDialogAtom,
	settingsDialogAtom,
	timeShiftDialogAtom,
	timeStretchDialogAtom,
	ttmlChecklistDialogAtom,
} from "$/states/dialogs.ts";
import {
	keyDeleteSelectionAtom,
	keyNewFileAtom,
	keyOpenFileAtom,
	keyRedoAtom,
	keySaveFileAtom,
	keySelectAllAtom,
	keyUndoAtom,
	keyUnselectAllAtom,
} from "$/states/keybindings.ts";
import {
	canRedoLyricLinesAtom,
	canUndoLyricLinesAtom,
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	redoLyricLinesAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	startFreshLyricDocumentAtom,
	undoLyricLinesAtom,
} from "$/states/main.ts";
import { error, log } from "$/utils/logging.ts";
import { createHistoryActionGate } from "./history-action-gate";

export const useTopMenuActions = () => {
	const { t } = useTranslation();
	const exportT = useCallback<ExportTranslation>(
		(key, fallback, options) => t(key, fallback ?? key, options),
		[t],
	);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const newLyricLine = useSetAtom(newLyricLinesAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setMetadataEditorOpened = useSetAtom(metadataEditorDialogAtom);
	const setSettingsDialogOpened = useSetAtom(settingsDialogAtom);
	const canUndo = useAtomValue(canUndoLyricLinesAtom);
	const canRedo = useAtomValue(canRedoLyricLinesAtom);
	const store = useStore();
	const isDirty = useAtomValue(isDirtyAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const setHistoryRestoreDialog = useSetAtom(historyRestoreDialogAtom);
	const setProjectsDialog = useSetAtom(projectsDialogAtom);
	const setAdvancedSegmentationDialog = useSetAtom(
		advancedSegmentationDialogAtom,
	);
	const setAutoSegmentDialog = useSetAtom(autoSegmentDialogAtom);
	const savedSegmentationEngine = useAtomValue(segmentationEngineAtom);
	const setSplitEnglish = useSetAtom(segmentationSplitEnglishAtom);
	const setLearnedSplitsDialog = useSetAtom(learnedSplitsDialogAtom);
	const setTimeShiftDialog = useSetAtom(timeShiftDialogAtom);
	const setTimeStretchDialog = useSetAtom(timeStretchDialogAtom);
	const setTTMLChecklistDialog = useSetAtom(ttmlChecklistDialogAtom);
	const { openFile } = useFileOpener();
	const { pickFiles } = useLoadAudio();
	const setProjectId = useSetAtom(projectIdAtom);
	const { config: segmentationConfig } = useSegmentationConfig();
	const newFileKey = useAtomValue(keyNewFileAtom);
	const openFileKey = useAtomValue(keyOpenFileAtom);
	const saveFileKey = useAtomValue(keySaveFileAtom);
	const undoKey = useAtomValue(keyUndoAtom);
	const redoKey = useAtomValue(keyRedoAtom);
	const selectAllLinesKey = useAtomValue(keySelectAllAtom);
	const unselectAllLinesKey = useAtomValue(keyUnselectAllAtom);
	const deleteSelectionKey = useAtomValue(keyDeleteSelectionAtom);
	const runHistoryAction = useMemo(
		() => createHistoryActionGate(requestAnimationFrame),
		[],
	);

	const onNewFile = useCallback(() => {
		const action = () => {
			newLyricLine();
			store.set(startFreshLyricDocumentAtom);
			// A new standalone file must not inherit the open folder project, or
			// saving/autosave would overwrite that project's lyrics.
			store.set(activeProjectDirAtom, null);
			store.set(activeProjectManifestAtom, null);
			store.set(projectAudioFileAtom, null);
			setProjectId(uid());
			setSaveFileName("lyric.ttml");
		};

		if (isDirty) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.newFile.title", "Start new lyrics?"),
				description: t(
					"confirmDialog.newFile.description",
					"当前文件有未保存的更改。如果继续，这些更改将会丢失。确定要新建文件吗？",
				),
				onConfirm: action,
			});
		} else {
			action();
		}
	}, [
		isDirty,
		newLyricLine,
		setConfirmDialog,
		t,
		setProjectId,
		setSaveFileName,
		store,
	]);

	// Takes lyrics, audio or one of each, like Load audio, but remembers its
	// own folder.
	const onOpenFile = useCallback(() => pickFiles("openFile"), [pickFiles]);

	const onOpenFileFromClipboard = useCallback(async () => {
		try {
			const ttmlText = await navigator.clipboard.readText();
			const file = new File([ttmlText], "lyric.ttml", {
				type: "application/xml",
			});
			openFile(file);
		} catch (e) {
			error("Failed to parse TTML file from clipboard", e);
		}
	}, [openFile]);

	const onSaveFile = useCallback(async () => {
		await saveTTML(store, exportT);
	}, [store, exportT]);

	const onOpenProjects = useCallback(() => {
		setProjectsDialog(true);
	}, [setProjectsDialog]);

	const onOpenHistoryRestore = useCallback(() => {
		setHistoryRestoreDialog(true);
	}, [setHistoryRestoreDialog]);

	const onSaveFileToClipboard = useCallback(
		() => copyTTML(store, exportT),
		[store, exportT],
	);

	const onOpenMetadataEditor = useCallback(() => {
		setMetadataEditorOpened(true);
	}, [setMetadataEditorOpened]);

	const onOpenSettings = useCallback(() => {
		setSettingsDialogOpened(true);
	}, [setSettingsDialogOpened]);

	const onOpenLatencyTest = useCallback(() => {
		store.set(latencyTestDialogAtom, true);
	}, [store]);

	const onOpenTTMLChecklist = useCallback(() => {
		setTTMLChecklistDialog(true);
	}, [setTTMLChecklistDialog]);

	const onOpenGitHub = useCallback(async () => {
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open("https://github.com/spicylyrics/ttml-tool");
		} else {
			window.open("https://github.com/spicylyrics/ttml-tool");
		}
	}, []);

	const onOpenGuides = useCallback(async () => {
		const url = getGuideUrl("intro");
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open(url);
		} else {
			window.open(url);
		}
	}, []);

	const onUndo = useCallback(() => {
		if (!store.get(canUndoLyricLinesAtom)) return;
		runHistoryAction(() => store.set(undoLyricLinesAtom));
	}, [runHistoryAction, store]);

	const onRedo = useCallback(() => {
		if (!store.get(canRedoLyricLinesAtom)) return;
		runHistoryAction(() => store.set(redoLyricLinesAtom));
	}, [runHistoryAction, store]);

	const onUnselectAll = useCallback(() => {
		const immerSelectedLinesAtom = withImmer(selectedLinesAtom);
		const immerSelectedWordsAtom = withImmer(selectedWordsAtom);
		store.set(immerSelectedLinesAtom, (old) => {
			old.clear();
		});
		store.set(immerSelectedWordsAtom, (old) => {
			old.clear();
		});
	}, [store]);

	const onSelectAll = useCallback(() => {
		const lines = store.get(lyricLinesAtom).lyricLines;
		const selectedLineIds = store.get(selectedLinesAtom);
		const selectedLines = lines.filter((l) => selectedLineIds.has(l.id));
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedWords = lines
			.flatMap((l) => l.words)
			.filter((w) => selectedWordIds.has(w.id));
		if (selectedWords.length > 0) {
			const tmpWordIds = new Set(selectedWordIds);
			for (const selLine of selectedLines) {
				for (const word of selLine.words) {
					tmpWordIds.delete(word.id);
				}
			}
			if (tmpWordIds.size === 0) {
				store.set(
					selectedWordsAtom,
					new Set(selectedLines.flatMap((line) => line.words.map((w) => w.id))),
				);
				return;
			}
		} else {
			store.set(
				selectedLinesAtom,
				new Set(store.get(lyricLinesAtom).lyricLines.map((l) => l.id)),
			);
		}
		const sel = window.getSelection();
		if (sel) {
			if (sel.empty) {
				sel.empty();
			} else if (sel.removeAllRanges) {
				sel.removeAllRanges();
			}
		}
	}, [store]);

	const onDeleteSelection = useCallback(() => {
		const selectedWordIds = store.get(selectedWordsAtom);
		const selectedLineIds = store.get(selectedLinesAtom);
		log("deleting selections", selectedWordIds, selectedLineIds);
		if (selectedWordIds.size === 0) {
			editLyricLines((prev) => {
				prev.lyricLines = prev.lyricLines.filter(
					(l) => !selectedLineIds.has(l.id),
				);
			});
		} else {
			editLyricLines((prev) => {
				deleteWordsFromLines(prev.lyricLines, selectedWordIds);
			});
		}
		store.set(selectedWordsAtom, new Set());
		store.set(selectedLinesAtom, new Set());
	}, [store, editLyricLines]);

	const onAutoSegment = useCallback(() => {
		setAutoSegmentDialog(true);
	}, [setAutoSegmentDialog]);

	const onQuickAutoSegment = useCallback(() => {
		if (
			!matchesSavedSyllabificationEngine(
				store.get(lyricLinesAtom).lyricLines,
				savedSegmentationEngine,
			)
		) {
			setAutoSegmentDialog(true);
			return;
		}

		setSplitEnglish(savedSegmentationEngine !== "none");
		editLyricLines((draft) => {
			draft.lyricLines = segmentLyricLines(draft.lyricLines, {
				...segmentationConfig,
				engine: savedSegmentationEngine,
				splitEnglish: savedSegmentationEngine !== "none",
			});
		});
		toast.success(
			t("autoSegmentApplied", {
				defaultValue: "Auto-segmented with {engine}",
				engine:
					SYLLABIFICATION_ENGINES.find(
						({ id }) => id === savedSegmentationEngine,
					)?.name ?? savedSegmentationEngine,
			}),
		);
	}, [
		editLyricLines,
		savedSegmentationEngine,
		store,
		segmentationConfig,
		setAutoSegmentDialog,
		setSplitEnglish,
		t,
	]);

	const onOpenTimeShift = useCallback(() => {
		setTimeShiftDialog(true);
	}, [setTimeShiftDialog]);

	const onOpenTimeStretch = useCallback(() => {
		setTimeStretchDialog(true);
	}, [setTimeStretchDialog]);

	const onSyncLineTimestamps = useCallback(() => {
		const action = () => {
			editLyricLines((draft) => {
				for (let i = 0; i < draft.lyricLines.length; i++) {
					const line = draft.lyricLines[i];
					if (line.words.length === 0) continue;

					let startTime = line.words[0].startTime;
					let endTime = line.words[line.words.length - 1].endTime;

					if (i + 1 < draft.lyricLines.length) {
						const nextLine = draft.lyricLines[i + 1];
						if (nextLine.isBG && nextLine.words.length > 0) {
							const nextLineStart = nextLine.words[0].startTime;
							const nextLineEnd =
								nextLine.words[nextLine.words.length - 1].endTime;
							startTime = Math.min(startTime, nextLineStart);
							endTime = Math.max(endTime, nextLineEnd);
						}
					}

					line.startTime = startTime;
					line.endTime = endTime;
				}
			});
		};

		setConfirmDialog({
			open: true,
			title: t(
				"confirmDialog.syncLineTimestamps.title",
				"Fit lines to their words?",
			),
			description: t(
				"confirmDialog.syncLineTimestamps.description",
				"This sets every line's start and end time to match its first and last word. Continue?",
			),
			onConfirm: action,
		});
	}, [editLyricLines, setConfirmDialog, t]);

	const onOpenAdvancedSegmentation = useCallback(() => {
		setAdvancedSegmentationDialog(true);
	}, [setAdvancedSegmentationDialog]);
	const onOpenLearnedSplits = useCallback(() => {
		setLearnedSplitsDialog(true);
	}, [setLearnedSplitsDialog]);

	return {
		newFileKey,
		openFileKey,
		saveFileKey,
		undoKey,
		redoKey,
		selectAllLinesKey,
		unselectAllLinesKey,
		deleteSelectionKey,
		undoDisabled: !canUndo,
		redoDisabled: !canRedo,
		onNewFile,
		onOpenFile,
		onOpenFileFromClipboard,
		onSaveFile,
		onOpenHistoryRestore,
		onOpenProjects,
		onSaveFileToClipboard,
		onUndo,
		onRedo,
		onSelectAll,
		onUnselectAll,
		onDeleteSelection,
		onOpenTimeShift,
		onOpenTimeStretch,
		onOpenMetadataEditor,
		onOpenSettings,
		onAutoSegment,
		onQuickAutoSegment,
		onOpenAdvancedSegmentation,
		onOpenLearnedSplits,
		onSyncLineTimestamps,
		onOpenLatencyTest,
		onOpenTTMLChecklist,
		onOpenGitHub,
		onOpenGuides,
	};
};
