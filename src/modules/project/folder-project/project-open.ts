import { isTauri } from "@tauri-apps/api/core";
import {
	exists,
	readDir,
	readTextFile,
	stat,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { getDefaultStore } from "jotai";
import { toast } from "react-toastify";
import { uid } from "uid";
import { audioEngine } from "$/modules/audio/audio-engine";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	startFreshLyricDocumentAtom,
} from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import { log, error as logError } from "$/utils/logging";
import { AUDIO_EXTS, loadProjectAudioFile } from "./audio-io";
import { isLinkedProjectDir } from "./linked-projects";
import { readProjectLyricFile } from "./lyric-io";
import {
	assertSafePath,
	getFileExtension,
	getFileNameFromPath,
	isProjectManifest,
	isSafeProjectFileName,
} from "./manifest";
import { resolveManifestFiles, splitDirPath } from "./project-folder-sync";
import { getSongInfo } from "./project-naming";
import { upsertRecentProject } from "./recent-projects";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	projectAudioFileAtom,
} from "./state";
import {
	PROJECT_MANIFEST_APP_ID,
	PROJECT_MANIFEST_FILENAME,
	type ProjectManifest,
} from "./types";
import { pickProjectFolder, rememberProjectWorkspace } from "./workspace";

type Store = ReturnType<typeof getDefaultStore>;
type TFunc = (
	key: string,
	fallback?: string,
	options?: Record<string, unknown>,
) => string;

export async function loadProjectFromDir(
	dir: string,
	store: Store,
	t: TFunc,
): Promise<boolean> {
	if (!isTauri()) {
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return false;
	}

	try {
		audioEngine.pauseMusic();
	} catch (e) {
		logError("Failed to pause music before loading project", e);
	}

	let manifestText: string;
	try {
		const manifestPath = assertSafePath(dir, PROJECT_MANIFEST_FILENAME);
		const manifestStat = await stat(manifestPath);
		if (!manifestStat.isFile || manifestStat.size > 1024 * 1024) {
			throw new Error("Invalid manifest file or size exceeds 1MB limit");
		}
		manifestText = await readTextFile(manifestPath);
	} catch (e) {
		logError(`Failed to read project manifest in ${dir}`, e);
		toast.error(
			t("error.folderProjectInvalid", "Invalid project manifest file"),
		);
		return false;
	}

	let parsedManifest: unknown;
	try {
		parsedManifest = JSON.parse(manifestText);
	} catch (e) {
		logError("Failed to parse project manifest JSON", e);
		toast.error(
			t("error.folderProjectInvalid", "Invalid project manifest file"),
		);
		return false;
	}

	if (!isProjectManifest(parsedManifest)) {
		logError("Manifest schema validation failed", parsedManifest);
		toast.error(
			t("error.folderProjectInvalid", "Invalid project manifest file"),
		);
		return false;
	}

	if (
		parsedManifest.lyricFile &&
		!isSafeProjectFileName(parsedManifest.lyricFile)
	) {
		logError(`Unsafe lyric filename in manifest: ${parsedManifest.lyricFile}`);
		toast.error(
			t("error.folderProjectInvalid", "Invalid project manifest file"),
		);
		return false;
	}
	if (
		parsedManifest.audioFile &&
		!isSafeProjectFileName(parsedManifest.audioFile)
	) {
		logError(`Unsafe audio filename in manifest: ${parsedManifest.audioFile}`);
		toast.error(
			t("error.folderProjectInvalid", "Invalid project manifest file"),
		);
		return false;
	}

	const linked = parsedManifest.linked;
	if (linked && !(await isLinkedProjectDir(dir))) {
		logError(`Linked manifest outside the linked projects folder: ${dir}`);
		toast.error(
			t("error.folderProjectInvalid", "Invalid project manifest file"),
		);
		return false;
	}
	const validManifest: ProjectManifest = linked
		? parsedManifest
		: await resolveManifestFiles(dir, parsedManifest);
	const lyricLocation = linked
		? splitDirPath(linked.lyricPath)
		: { parent: dir, base: validManifest.lyricFile };
	const audioLocation = linked
		? splitDirPath(linked.audioPath)
		: { parent: dir, base: validManifest.audioFile };

	const lyricFileName = validManifest.lyricFile;
	let lyricData: TTMLLyric = { lyricLines: [], metadata: [] };
	if (lyricFileName) {
		try {
			lyricData = await readProjectLyricFile(
				lyricLocation.parent,
				lyricLocation.base,
			);
		} catch (e) {
			logError(`Failed to load lyric file: ${lyricFileName}`, e);
			toast.error(
				t("error.folderProjectLyricParse", "Failed to parse lyric file"),
			);
			return false;
		}
	} else {
		toast.info(
			t(
				"error.folderProjectNoLyric",
				"Add a lyric file before saving the project",
			),
		);
	}

	let audioFile: File | null = null;
	if (validManifest.audioFile) {
		try {
			audioFile = await loadProjectAudioFile(
				audioLocation.parent,
				audioLocation.base,
			);
			if (!audioFile) {
				toast.warning(
					t(
						"error.folderProjectAudioReadFailed",
						"Project audio file not found",
					),
				);
			}
		} catch (e) {
			logError(`Failed to read project audio: ${validManifest.audioFile}`, e);
			toast.warning(
				t(
					"error.folderProjectAudioReadFailed",
					(e as Error)?.message ?? "Failed to read project audio file",
				),
			);
		}
	}

	const nextManifest: ProjectManifest = {
		...validManifest,
		lyricFile: lyricFileName,
		updatedAt: validManifest.updatedAt ?? Date.now(),
		createdAt: validManifest.createdAt ?? Date.now(),
	};

	store.set(projectIdAtom, uid());
	store.set(newLyricLinesAtom, lyricData);
	store.set(startFreshLyricDocumentAtom);
	store.set(saveFileNameAtom, lyricFileName);
	store.set(projectAudioFileAtom, audioFile);

	store.set(activeProjectDirAtom, dir);
	store.set(activeProjectManifestAtom, nextManifest);
	if (!linked) await rememberProjectWorkspace(store, dir);

	if (audioFile) {
		try {
			await audioEngine.loadMusic(audioFile);
		} catch (e) {
			logError("Failed to load project audio into audio engine", e);
			toast.error(
				t("error.folderProjectAudioLoadFailed", "Failed to load project audio"),
			);
		}
	} else {
		audioEngine.unloadMusic();
		toast.info(
			t(
				"error.folderProjectNoAudio",
				"Load an audio file before saving the project",
			),
		);
	}

	log(`Opened folder project: ${nextManifest.name} (${dir})`);
	await upsertRecentProject({
		dir,
		name: nextManifest.name,
		audioFile: nextManifest.audioFile,
		lyricFile: nextManifest.lyricFile,
		lastOpened: Date.now(),
		updatedAt: nextManifest.updatedAt,
		linked: nextManifest.linked,
	});
	return true;
}

export async function importProjectDir(
	dir: string,
	store: Store,
	t: TFunc,
): Promise<boolean> {
	if (!isTauri()) {
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return false;
	}

	try {
		audioEngine.pauseMusic();
	} catch (e) {
		logError("Failed to pause music before importing project", e);
	}

	let entries: Awaited<ReturnType<typeof readDir>> = [];
	try {
		entries = await readDir(dir);
	} catch (e) {
		logError(`Failed to list project folder: ${dir}`, e);
		toast.error(
			t(
				"error.folderProjectUnavailable",
				"The project folder is not accessible",
			),
		);
		return false;
	}

	const audioEntry = entries.find(
		(e) => e.isFile && AUDIO_EXTS.has(getFileExtension(e.name)),
	);
	const ttmlEntry = entries.find(
		(e) => e.isFile && getFileExtension(e.name) === "ttml",
	);

	if (!audioEntry && !ttmlEntry) {
		toast.error(
			t(
				"error.folderProjectNoContent",
				"No TTML or audio files found in this folder",
			),
		);
		return false;
	}

	let lyricData: TTMLLyric = { lyricLines: [], metadata: [] };
	let lyricFileName = "";
	if (ttmlEntry) {
		try {
			lyricData = await readProjectLyricFile(dir, ttmlEntry.name);
			lyricFileName = ttmlEntry.name;
		} catch (e) {
			logError(`Failed to parse lyric file: ${ttmlEntry.name}`, e);
			toast.error(
				t("error.folderProjectLyricParse", "Failed to parse lyric file"),
			);
			return false;
		}
	}

	let audioFile: File | null = null;
	let audioFileName = "";
	if (audioEntry) {
		try {
			audioFile = await loadProjectAudioFile(dir, audioEntry.name);
			if (audioFile) {
				audioFileName = audioEntry.name;
			}
		} catch (e) {
			logError(`Failed to read audio file: ${audioEntry.name}`, e);
			toast.warning(
				t(
					"error.folderProjectAudioReadFailed",
					(e as Error)?.message ?? "Failed to read project audio file",
				),
			);
		}
	}

	const suggested = getSuggestedTtmlFileName(lyricData.metadata);
	const nextManifest: ProjectManifest = {
		version: 1,
		app: PROJECT_MANIFEST_APP_ID,
		projectId: uid(),
		song: getSongInfo(lyricData.metadata, audioFile?.size),
		name: suggested?.baseName ?? getFileNameFromPath(dir),
		audioFile: audioFileName,
		lyricFile: lyricFileName,
		createdAt: Date.now(),
		updatedAt: Date.now(),
	};

	try {
		const manifestPath = assertSafePath(dir, PROJECT_MANIFEST_FILENAME);
		await writeTextFile(manifestPath, JSON.stringify(nextManifest, null, 2));
	} catch (e) {
		logError("Failed to write project manifest during import", e);
		toast.error(t("error.folderProjectSaveFailed", "Failed to save project"));
		return false;
	}

	// Only touch the editor once the manifest exists, so a failed import can't
	// leave imported lyrics attached to the previously active project.
	store.set(projectIdAtom, uid());
	store.set(newLyricLinesAtom, lyricData);
	store.set(startFreshLyricDocumentAtom);
	store.set(saveFileNameAtom, lyricFileName);
	store.set(projectAudioFileAtom, audioFile);
	store.set(activeProjectDirAtom, dir);
	store.set(activeProjectManifestAtom, nextManifest);
	await rememberProjectWorkspace(store, dir);

	if (audioFile) {
		try {
			await audioEngine.loadMusic(audioFile);
		} catch (e) {
			logError("Failed to load project audio into audio engine", e);
			toast.error(
				t("error.folderProjectAudioLoadFailed", "Failed to load project audio"),
			);
		}
	} else {
		audioEngine.unloadMusic();
	}

	log(`Imported folder project: ${nextManifest.name} (${dir})`);
	await upsertRecentProject({
		dir,
		name: nextManifest.name,
		audioFile: nextManifest.audioFile,
		lyricFile: nextManifest.lyricFile,
		lastOpened: Date.now(),
		updatedAt: nextManifest.updatedAt,
	});
	return true;
}

export async function openProjectFromDir(
	dir: string,
	store: Store,
	t: TFunc,
): Promise<void> {
	if (!isTauri()) {
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return;
	}

	const executeOpen = async () => {
		try {
			const manifestPath = assertSafePath(dir, PROJECT_MANIFEST_FILENAME);
			const hasManifest = await exists(manifestPath).catch(() => false);
			if (hasManifest) {
				await loadProjectFromDir(dir, store, t);
				return;
			}

			let entries: Awaited<ReturnType<typeof readDir>> = [];
			try {
				entries = await readDir(dir);
			} catch (e) {
				logError(`Failed to list project folder: ${dir}`, e);
				toast.error(
					t(
						"error.folderProjectUnavailable",
						"The project folder is not accessible",
					),
				);
				return;
			}

			const hasAudio = entries.some(
				(e) => e.isFile && AUDIO_EXTS.has(getFileExtension(e.name)),
			);
			const hasLyric = entries.some(
				(e) => e.isFile && getFileExtension(e.name) === "ttml",
			);
			if (hasAudio || hasLyric) {
				await importProjectDir(dir, store, t);
				return;
			}

			toast.error(
				t(
					"error.folderProjectNotFound",
					"The selected folder is not a valid project folder (no project.json, TTML, or audio files)",
				),
			);
		} catch (e) {
			logError("Failed to open folder project", e);
			toast.error(
				t(
					"error.folderProjectOpenFailed",
					"Failed to open project folder: {reason}",
					{
						reason: String((e as Error)?.message ?? e),
					},
				),
			);
		}
	};

	if (store.get(isDirtyAtom)) {
		store.set(confirmDialogAtom, {
			open: true,
			title: t("confirmDialog.openFile.title", "Open another file?"),
			description: t(
				"confirmDialog.openFile.description",
				"You have unsaved changes. If you proceed, these changes will be lost. Are you sure you want to open a new file?",
			),
			onConfirm: executeOpen,
		});
	} else {
		await executeOpen();
	}
}

export async function openProject(store: Store, t: TFunc): Promise<void> {
	if (!isTauri()) {
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return;
	}

	const executeOpen = async () => {
		try {
			const picked = await pickProjectFolder(
				t("dialog.openProject.title", "Select project folder"),
			);
			if (!picked) {
				return;
			}
			await openProjectFromDir(picked, store, t);
		} catch (e) {
			logError("Failed to open project dialog", e);
			toast.error(
				t(
					"error.folderProjectOpenFailed",
					"Failed to open project folder: {reason}",
					{
						reason: String((e as Error)?.message ?? e),
					},
				),
			);
		}
	};

	if (store.get(isDirtyAtom)) {
		store.set(confirmDialogAtom, {
			open: true,
			title: t("confirmDialog.openFile.title", "Open another file?"),
			description: t(
				"confirmDialog.openFile.description",
				"You have unsaved changes. If you proceed, these changes will be lost. Are you sure you want to open a new file?",
			),
			onConfirm: executeOpen,
		});
	} else {
		await executeOpen();
	}
}
