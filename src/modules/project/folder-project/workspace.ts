import { invoke, isTauri } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import type { getDefaultStore } from "jotai";
import { toast } from "react-toastify";
import { confirmDialogAtom } from "$/states/dialogs";
import { isDirtyAtom } from "$/states/main";
import { lastFolder, rememberPick } from "$/utils/dialog-folders";
import { error as logError } from "$/utils/logging";
import {
	workspaceDirAtom,
	workspaceProjectsAtom,
	workspaceScanningAtom,
} from "./state";
import { type ScannedProject, scanProjectWorkspace } from "./workspace-scan";

type Store = ReturnType<typeof getDefaultStore>;
type TFunc = (
	key: string,
	fallback?: string,
	options?: Record<string, unknown>,
) => string;

/**
 * Opens the backend-owned folder picker, which grants the picked folder's
 * parent to the fs scope. Scope is never widened from a webview-supplied path.
 */
export async function pickProjectFolder(title: string): Promise<string | null> {
	return (
		(await invoke<string | null>("pick_project_folder", { title })) ?? null
	);
}

export async function rememberProjectWorkspace(
	store: Store,
	projectDir: string,
): Promise<void> {
	const normalized = projectDir.replace(/\\/g, "/").replace(/\/+$/, "");
	const separator = normalized.lastIndexOf("/");
	if (separator <= 0) return;
	store.set(workspaceDirAtom, normalized.slice(0, separator));
}

export async function openWorkspaceDialog(
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

	const executeScan = async () => {
		try {
			const dir = await open({
				directory: true,
				multiple: false,
				recursive: true,
				title: t(
					"dialog.openWorkspace.title",
					"Select a workspace folder containing projects",
				),
				defaultPath: lastFolder("workspace"),
			});
			if (!dir || typeof dir !== "string") return;
			rememberPick("workspace", dir);

			store.set(workspaceScanningAtom, true);
			store.set(workspaceDirAtom, dir);
			try {
				const results = await scanProjectWorkspace(dir);
				store.set(workspaceProjectsAtom, results);
				if (results.length === 0) {
					toast.info(
						t("workspace.noProjectsFound", "No projects found in this folder"),
					);
				} else {
					toast.success(
						t(
							"workspace.projectsFound",
							"{count, plural, one {Found # project} other {Found # projects}}",
							{
								count: results.length,
							},
						),
					);
				}
			} finally {
				store.set(workspaceScanningAtom, false);
			}
		} catch (e) {
			logError("Failed to scan workspace", e);
			toast.error(t("workspace.scanFailed", "Failed to scan workspace folder"));
			store.set(workspaceScanningAtom, false);
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
			onConfirm: executeScan,
		});
	} else {
		await executeScan();
	}
}

export async function rescanWorkspace(
	store: Store,
	t?: TFunc,
): Promise<ScannedProject[]> {
	const currentDir = store.get(workspaceDirAtom);
	if (!currentDir) return [];

	store.set(workspaceScanningAtom, true);
	try {
		const results = await scanProjectWorkspace(currentDir);
		store.set(workspaceProjectsAtom, results);
		return results;
	} catch (e) {
		logError("Failed to rescan workspace", e);
		if (t) {
			toast.error(t("workspace.scanFailed", "Failed to scan workspace folder"));
		}
		return [];
	} finally {
		store.set(workspaceScanningAtom, false);
	}
}
