import { isTauri } from "@tauri-apps/api/core";
import {
	exists,
	mkdir,
	readDir,
	readTextFile,
	remove,
	rename,
	writeTextFile,
} from "@tauri-apps/plugin-fs";
import type { getDefaultStore } from "jotai";
import { toast } from "react-toastify";
import { uid } from "uid";
import { audioEngine } from "$/modules/audio/audio-engine";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import {
	allowConsecutiveBackgroundLinesAtom,
	lyricTextNormalizationOptionsAtom,
} from "$/modules/settings/states";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	lyricLinesAtom,
	markLyricsSavedAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	startFreshLyricDocumentAtom,
} from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";
import { log, error as logError } from "$/utils/logging";
import type { PreparedTTML } from "../logic/ttml-export";
import { getTTMLSaveName } from "../logic/ttml-save-name";
import { writeProjectAudioFile } from "./audio-io";
import { isLinkedProjectDir } from "./linked-projects";
import { generateProjectTtmlText, writeProjectLyricFile } from "./lyric-io";
import {
	assertSafePath,
	ensureExtension,
	getFileExtension,
	getFileNameFromPath,
	sanitizeFileName,
} from "./manifest";
import { splitDirPath, syncProjectFolderName } from "./project-folder-sync";
import { getSongInfo } from "./project-naming";
import { loadProjectFromDir } from "./project-open";
import { upsertRecentProject } from "./recent-projects";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	projectAudioFileAtom,
} from "./state";
import {
	LINKED_LYRIC_BACKUP_FILENAME,
	type LinkedProjectFiles,
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

export function generateLyricTextFromStore(
	store: Store,
	t: TFunc,
): string | null {
	const lyric = store.get(lyricLinesAtom);
	try {
		return generateProjectTtmlText(
			lyric,
			store.get(lyricTextNormalizationOptionsAtom),
			{
				allowConsecutiveBackgroundLines: store.get(
					allowConsecutiveBackgroundLinesAtom,
				),
			},
		);
	} catch (e) {
		logError("Error generating TTML from store", e);
		toast.error(t("error.ttmlGenerateFailed", "Failed to generate TTML"));
		return null;
	}
}

/**
 * Removes a file superseded by a save. Only call this after the replacement
 * and manifest are written, so a failed save never loses the original.
 * Returns false when cleanup failed.
 */
async function removeReplacedFile(
	dir: string,
	oldName: string | undefined,
	newName: string,
): Promise<boolean> {
	if (!oldName || !newName || oldName === newName) return true;
	try {
		if (oldName.toLowerCase() === newName.toLowerCase()) {
			// A case-only rename is one file on case-insensitive filesystems
			// (Windows, default macOS) but two on case-sensitive ones. Only delete
			// when the folder really lists both names as separate entries.
			const names = new Set((await readDir(dir)).map((e) => e.name));
			if (!names.has(oldName) || !names.has(newName)) return true;
		}
		const oldPath = assertSafePath(dir, oldName);
		if (await exists(oldPath)) await remove(oldPath);
		return true;
	} catch (e) {
		logError(`Failed to remove replaced project file: ${oldName}`, e);
		return false;
	}
}

/**
 * Keeps a one-time copy of the user's linked TTML before the app first
 * overwrites it. The copy goes in the project's own app-data folder: the fs
 * scope only covers the linked file itself, not its siblings.
 * Returns false when the backup could not be made, so the caller must not
 * overwrite the original.
 */
async function ensureLinkedBackup(
	dir: string,
	lyricPath: string,
): Promise<boolean> {
	try {
		if (!(await exists(lyricPath))) return true;
		const backupPath = assertSafePath(dir, LINKED_LYRIC_BACKUP_FILENAME);
		if (await exists(backupPath)) return true;
		const tempPath = assertSafePath(dir, `${LINKED_LYRIC_BACKUP_FILENAME}.tmp`);
		await mkdir(dir, { recursive: true });
		await writeTextFile(tempPath, await readTextFile(lyricPath));
		await rename(tempPath, backupPath);
		log(`Backed up linked lyric file to ${backupPath}`);
		return true;
	} catch (e) {
		logError("Failed to back up linked lyric file", e);
		return false;
	}
}

async function saveLinkedProject(
	store: Store,
	t: TFunc,
	dir: string,
	manifest: ProjectManifest & { linked: LinkedProjectFiles },
	options?: { silent?: boolean; prepared?: PreparedTTML; onSaved?: () => void },
): Promise<boolean> {
	const lyric = options?.prepared?.lyric ?? store.get(lyricLinesAtom);
	if (lyric.lyricLines.length === 0) {
		if (!options?.silent) {
			toast.info(
				t(
					"error.folderProjectNoLyric",
					"Add a lyric file before saving the project",
				),
			);
		}
		return false;
	}
	const lyricText =
		options?.prepared?.text ?? generateLyricTextFromStore(store, t);
	if (lyricText == null) return false;

	if (!(await isLinkedProjectDir(dir))) {
		logError(`Refused linked save outside the linked projects folder: ${dir}`);
		return false;
	}

	// The linked file belongs to the user, not to the app: keep a one-time
	// backup before the first overwrite, so a lossy TTML round-trip can never
	// silently destroy the only copy.
	if (!(await ensureLinkedBackup(dir, manifest.linked.lyricPath))) {
		if (!options?.silent) {
			toast.error(
				t(
					"error.linkedProjectBackupFailed",
					"Could not back up the original TTML file, so it was not overwritten",
				),
			);
		}
		return false;
	}

	try {
		const target = splitDirPath(manifest.linked.lyricPath);
		await writeProjectLyricFile(target.parent, target.base, lyricText);

		const suggested = getSuggestedTtmlFileName(lyric.metadata);
		const nextManifest: ProjectManifest = {
			...manifest,
			app: PROJECT_MANIFEST_APP_ID,
			projectId: manifest.projectId ?? uid(),
			name: manifest.nameEdited
				? manifest.name
				: (suggested?.baseName ?? manifest.name),
			song: getSongInfo(lyric.metadata, manifest.song?.audioSize),
			updatedAt: Date.now(),
		};
		await mkdir(dir, { recursive: true });
		const manifestPath = assertSafePath(dir, PROJECT_MANIFEST_FILENAME);
		await writeTextFile(manifestPath, JSON.stringify(nextManifest, null, 2));

		store.set(activeProjectDirAtom, dir);
		store.set(activeProjectManifestAtom, nextManifest);
		store.set(saveFileNameAtom, nextManifest.lyricFile);
		store.set(markLyricsSavedAtom, lyric);
		options?.onSaved?.();

		if (!options?.silent) {
			toast.success(t("success.folderProjectSaved", "Project saved"));
		}
		log(`Saved linked project: ${nextManifest.name} (${dir})`);
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
	} catch (e) {
		logError("Failed to save linked project", e);
		if (!options?.silent) {
			toast.error(t("error.folderProjectSaveFailed", "Failed to save project"));
		}
		return false;
	}
}

export async function createProject(store: Store, t: TFunc): Promise<void> {
	if (!isTauri()) {
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return;
	}

	const executeCreate = async () => {
		try {
			audioEngine.pauseMusic();
			const pickedDir = await pickProjectFolder(
				t(
					"dialog.createProject.title",
					"Select or create a folder for the new project",
				),
			);
			if (!pickedDir) {
				return;
			}

			try {
				await mkdir(pickedDir, { recursive: true });
			} catch (e) {
				logError(`Failed to create project directory: ${pickedDir}`, e);
				toast.error(
					t("error.folderProjectCreateFailed", "Failed to create project"),
				);
				return;
			}

			const manifestPath = assertSafePath(pickedDir, PROJECT_MANIFEST_FILENAME);
			const hasManifest = await exists(manifestPath).catch(() => false);
			if (hasManifest) {
				toast.info(
					t(
						"success.folderProjectAlreadyExists",
						"This folder is already a project, opening it instead",
					),
				);
				await loadProjectFromDir(pickedDir, store, t);
				return;
			}

			const nextManifest: ProjectManifest = {
				version: 1,
				name: getFileNameFromPath(pickedDir),
				audioFile: "",
				lyricFile: "",
				createdAt: Date.now(),
				updatedAt: Date.now(),
			};

			try {
				await writeTextFile(
					manifestPath,
					JSON.stringify(nextManifest, null, 2),
				);
			} catch (e) {
				logError("Failed to write project manifest for new project", e);
				toast.error(
					t("error.folderProjectCreateFailed", "Failed to create project"),
				);
				return;
			}

			// Reset the editor only once the project exists on disk.
			const emptyLyric: TTMLLyric = { lyricLines: [], metadata: [] };
			store.set(projectIdAtom, uid());
			store.set(newLyricLinesAtom, emptyLyric);
			store.set(startFreshLyricDocumentAtom);
			store.set(saveFileNameAtom, "");
			store.set(projectAudioFileAtom, null);
			audioEngine.unloadMusic();
			store.set(activeProjectDirAtom, pickedDir);
			store.set(activeProjectManifestAtom, nextManifest);
			await rememberProjectWorkspace(store, pickedDir);

			toast.success(t("success.folderProjectCreated", "Project created"));
			log(`Created folder project: ${nextManifest.name} (${pickedDir})`);
			await upsertRecentProject({
				dir: pickedDir,
				name: nextManifest.name,
				audioFile: nextManifest.audioFile,
				lyricFile: nextManifest.lyricFile,
				lastOpened: Date.now(),
				updatedAt: nextManifest.updatedAt,
			});
		} catch (e) {
			logError("Failed to create folder project", e);
			toast.error(
				t("error.folderProjectCreateFailed", "Failed to create project"),
			);
		}
	};

	if (store.get(isDirtyAtom)) {
		store.set(confirmDialogAtom, {
			open: true,
			title: t("confirmDialog.newProject.title", "Create a new project?"),
			description: t(
				"confirmDialog.newProject.description",
				"You have unsaved changes. If you proceed, these changes will be lost. Are you sure you want to create a new project?",
			),
			onConfirm: executeCreate,
		});
	} else {
		await executeCreate();
	}
}

export async function saveProject(
	store: Store,
	t: TFunc,
	options?: { prepared?: PreparedTTML; onSaved?: () => void },
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

	let dir = store.get(activeProjectDirAtom);
	if (!dir) {
		const picked = await pickProjectFolder(
			t("dialog.saveProject.title", "Select or create a project folder"),
		);
		if (!picked) {
			return false;
		}
		dir = picked;
	}

	const manifest = store.get(activeProjectManifestAtom);
	if (manifest?.linked) {
		return saveLinkedProject(
			store,
			t,
			dir,
			{
				...manifest,
				linked: manifest.linked,
			},
			options,
		);
	}
	const audioFile = store.get(projectAudioFileAtom);
	const lyric = options?.prepared?.lyric ?? store.get(lyricLinesAtom);
	const hasLyricContent = lyric.lyricLines.length > 0;
	const shouldWriteLyric = hasLyricContent;
	const suggested = getSuggestedTtmlFileName(lyric.metadata);

	const lyricFileName = shouldWriteLyric
		? getTTMLSaveName(lyric, store.get(saveFileNameAtom), manifest)
		: "";

	const lyricText = shouldWriteLyric
		? (options?.prepared?.text ?? generateLyricTextFromStore(store, t))
		: null;
	if (shouldWriteLyric && lyricText == null) {
		return false;
	}

	const audioFileName = audioFile
		? ensureExtension(
				sanitizeFileName(audioFile.name),
				getFileExtension(audioFile.name),
			)
		: (manifest?.audioFile ?? "");

	try {
		await mkdir(dir, { recursive: true });

		if (lyricFileName && lyricText != null) {
			await writeProjectLyricFile(dir, lyricFileName, lyricText);
		}

		if (audioFile && audioFileName) {
			const arrayBuffer = await audioFile.arrayBuffer();
			await writeProjectAudioFile(
				dir,
				audioFileName,
				new Uint8Array(arrayBuffer),
			);
		}

		const nextManifest: ProjectManifest = {
			...manifest,
			version: 1,
			app: PROJECT_MANIFEST_APP_ID,
			projectId: manifest?.projectId ?? uid(),
			name: manifest?.nameEdited
				? manifest.name
				: (suggested?.baseName ?? manifest?.name ?? "Untitled"),
			audioFile: audioFileName,
			lyricFile: lyricFileName,
			song: getSongInfo(
				lyric.metadata,
				audioFile?.size ?? manifest?.song?.audioSize,
			),
			createdAt: manifest?.createdAt ?? Date.now(),
			updatedAt: Date.now(),
		};

		const manifestPath = assertSafePath(dir, PROJECT_MANIFEST_FILENAME);
		await writeTextFile(manifestPath, JSON.stringify(nextManifest, null, 2));

		store.set(activeProjectDirAtom, dir);
		store.set(activeProjectManifestAtom, nextManifest);
		await rememberProjectWorkspace(store, dir);
		store.set(saveFileNameAtom, lyricFileName);
		store.set(markLyricsSavedAtom, lyric);
		options?.onSaved?.();

		const lyricCleaned =
			!lyricFileName ||
			(await removeReplacedFile(dir, manifest?.lyricFile, lyricFileName));
		const audioCleaned =
			!audioFile ||
			(await removeReplacedFile(dir, manifest?.audioFile, audioFileName));
		if (!lyricCleaned || !audioCleaned) {
			toast.warning(
				t(
					"error.folderProjectCleanupFailed",
					"Saved, but a previous project file could not be removed",
				),
			);
		}

		toast.success(t("success.folderProjectSaved", "Project saved"));
		log(`Saved folder project: ${nextManifest.name} (${dir})`);
		await upsertRecentProject({
			dir,
			name: nextManifest.name,
			audioFile: nextManifest.audioFile,
			lyricFile: nextManifest.lyricFile,
			lastOpened: Date.now(),
			updatedAt: nextManifest.updatedAt,
		});
		await syncProjectFolderName(store);
		return true;
	} catch (e) {
		logError("Failed to save folder project", e);
		toast.error(t("error.folderProjectSaveFailed", "Failed to save project"));
		return false;
	}
}

export async function saveLyricsOnly(
	store: Store,
	t: TFunc,
	options?: { silent?: boolean; prepared?: PreparedTTML; onSaved?: () => void },
): Promise<boolean> {
	const activeDir = store.get(activeProjectDirAtom);
	const manifest = store.get(activeProjectManifestAtom);
	if (!activeDir || !manifest) {
		return true;
	}
	if (!isTauri()) return true;
	if (manifest.linked) {
		// Linked projects point at the user's own files, so autosave must
		// never touch them. Only an explicit save writes the linked file.
		if (options?.silent) return false;
		await saveLinkedProject(
			store,
			t,
			activeDir,
			{ ...manifest, linked: manifest.linked },
			options,
		);
		return false;
	}

	const lyric = options?.prepared?.lyric ?? store.get(lyricLinesAtom);
	if (lyric.lyricLines.length === 0) {
		if (!options?.silent) {
			toast.info(
				t(
					"error.folderProjectNoLyric",
					"Add a lyric file before saving the project",
				),
			);
		}
		return false;
	}

	const lyricText =
		options?.prepared?.text ?? generateLyricTextFromStore(store, t);
	if (lyricText == null) {
		return false;
	}

	try {
		const lyricFileName = getTTMLSaveName(
			lyric,
			store.get(saveFileNameAtom),
			manifest,
		);

		await writeProjectLyricFile(activeDir, lyricFileName, lyricText);

		const nextManifest: ProjectManifest = {
			...manifest,
			app: PROJECT_MANIFEST_APP_ID,
			projectId: manifest.projectId ?? uid(),
			lyricFile: lyricFileName,
			song: getSongInfo(lyric.metadata, manifest.song?.audioSize),
			updatedAt: Date.now(),
		};
		const manifestPath = assertSafePath(activeDir, PROJECT_MANIFEST_FILENAME);
		await writeTextFile(manifestPath, JSON.stringify(nextManifest, null, 2));

		if (store.get(activeProjectDirAtom) !== activeDir) return true;
		store.set(activeProjectManifestAtom, nextManifest);
		store.set(saveFileNameAtom, lyricFileName);
		store.set(markLyricsSavedAtom, lyric);
		options?.onSaved?.();
		const cleaned = await removeReplacedFile(
			activeDir,
			manifest.lyricFile,
			lyricFileName,
		);
		if (!cleaned && !options?.silent) {
			toast.warning(
				t(
					"error.folderProjectCleanupFailed",
					"Saved, but the previous lyric file could not be removed",
				),
			);
		}
		await syncProjectFolderName(store);

		if (!options?.silent) {
			toast.success(
				t("success.lyricsSavedToProject", "Lyrics saved to project"),
			);
		}
		return false;
	} catch (e) {
		logError("Failed to save lyrics into project", e);
		if (!options?.silent) {
			toast.error(t("error.folderProjectSaveFailed", "Failed to save project"));
		}
		return false;
	}
}

export async function renameProject(
	store: Store,
	nextName: string,
	t: TFunc,
): Promise<boolean> {
	if (!isTauri()) return false;
	const activeDir = store.get(activeProjectDirAtom);
	const manifest = store.get(activeProjectManifestAtom);
	if (!activeDir || !manifest) return false;

	const cleaned = sanitizeFileName(nextName);
	if (!cleaned || cleaned === manifest.name) return false;

	const nextManifest: ProjectManifest = {
		...manifest,
		name: cleaned,
		nameEdited: true,
		updatedAt: Date.now(),
	};

	try {
		const manifestPath = assertSafePath(activeDir, PROJECT_MANIFEST_FILENAME);
		await writeTextFile(manifestPath, JSON.stringify(nextManifest, null, 2));
	} catch (e) {
		logError("Failed to rename project", e);
		toast.error(t("error.folderProjectSaveFailed", "Failed to save project"));
		return false;
	}

	store.set(activeProjectManifestAtom, nextManifest);
	await upsertRecentProject({
		dir: activeDir,
		name: nextManifest.name,
		audioFile: nextManifest.audioFile,
		lyricFile: nextManifest.lyricFile,
		lastOpened: Date.now(),
		updatedAt: nextManifest.updatedAt,
		linked: nextManifest.linked,
	});
	toast.success(t("success.folderProjectSaved", "Project saved"));
	return true;
}
