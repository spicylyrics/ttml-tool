import { isTauri } from "@tauri-apps/api/core";
import { exists, readTextFile, remove, stat } from "@tauri-apps/plugin-fs";
import type { getDefaultStore } from "jotai";
import { toast } from "react-toastify";
import { log, error as logError } from "$/utils/logging";
import { isLinkedProjectDir } from "./linked-projects";
import { writeProjectLyricFile } from "./lyric-io";
import { assertSafePath } from "./manifest";
import { splitDirPath } from "./project-folder-sync";
import { loadProjectFromDir } from "./project-open";
import {
	LINKED_LYRIC_BACKUP_FILENAME,
	type LinkedProjectFiles,
	type ProjectManifest,
} from "./types";

export interface LinkedBackupInfo {
	exists: boolean;
	mtimeMs: number | null;
}

export function getLinkedBackupPath(dir: string): string | null {
	try {
		return assertSafePath(dir, LINKED_LYRIC_BACKUP_FILENAME);
	} catch (e) {
		logError("Failed to resolve linked backup path", e);
		return null;
	}
}

export async function linkedBackupExists(dir: string): Promise<boolean> {
	if (!isTauri()) return false;
	const backupPath = getLinkedBackupPath(dir);
	if (!backupPath) return false;
	try {
		return await exists(backupPath);
	} catch (e) {
		logError(`Failed to check existence for backup at ${backupPath}`, e);
		return false;
	}
}

export async function getLinkedBackupInfo(
	dir: string,
): Promise<LinkedBackupInfo> {
	if (!isTauri()) return { exists: false, mtimeMs: null };
	const backupPath = getLinkedBackupPath(dir);
	if (!backupPath) return { exists: false, mtimeMs: null };
	try {
		if (!(await exists(backupPath))) {
			return { exists: false, mtimeMs: null };
		}
		const s = await stat(backupPath);
		return {
			exists: true,
			mtimeMs: s.mtime ? new Date(s.mtime).getTime() : null,
		};
	} catch (e) {
		logError(`Failed to get backup info for ${backupPath}`, e);
		return { exists: false, mtimeMs: null };
	}
}

type Store = ReturnType<typeof getDefaultStore>;
type TFunc = (
	key: string,
	fallback?: string,
	options?: Record<string, unknown>,
) => string;

export async function restoreLinkedBackup(
	store: Store,
	t: TFunc,
	dir: string,
	manifest: ProjectManifest & { linked: LinkedProjectFiles },
): Promise<boolean> {
	if (!isTauri()) return false;
	const backupPath = getLinkedBackupPath(dir);
	if (!backupPath || !(await isLinkedProjectDir(dir))) {
		toast.error(t("error.folderProjectInvalid", "Invalid project folder"));
		return false;
	}
	try {
		if (!(await exists(backupPath))) {
			toast.error(
				t("error.linkedProjectNoBackup", "No backup found for this project"),
			);
			return false;
		}
		const backupContent = await readTextFile(backupPath);
		const target = splitDirPath(manifest.linked.lyricPath);
		await writeProjectLyricFile(target.parent, target.base, backupContent);
		log(
			`Restored linked TTML from ${backupPath} to ${manifest.linked.lyricPath}`,
		);
		const reloaded = await loadProjectFromDir(dir, store, t);
		if (!reloaded) {
			toast.error(
				t(
					"error.linkedProjectRestoreReloadFailed",
					"Restored original file, but failed to reload project",
				),
			);
			return false;
		}
		// The original is back in place, so the backup has done its job. The
		// next explicit save keeps a fresh one-time backup of it.
		try {
			await remove(backupPath);
		} catch (e) {
			logError(`Failed to remove the linked backup ${backupPath}`, e);
		}
		toast.success(
			t("success.linkedProjectBackupRestored", "Restored original TTML file"),
		);
		return true;
	} catch (e) {
		logError("Failed to restore linked TTML backup", e);
		toast.error(
			t(
				"error.linkedProjectRestoreFailed",
				"Failed to restore original TTML file",
			),
		);
		return false;
	}
}
