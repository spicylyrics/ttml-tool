import { invoke, isTauri } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { mkdir, readDir, writeTextFile } from "@tauri-apps/plugin-fs";
import type { getDefaultStore } from "jotai";
import { toast } from "react-toastify";
import { uid } from "uid";
import { folderProjectsEnabledAtom } from "$/modules/settings/states";
import { lyricLinesAtom, saveFileNameAtom } from "$/states/main";
import { lastFolder, rememberPick, savePathFor } from "$/utils/dialog-folders";
import { log, error as logError } from "$/utils/logging";
import { AUDIO_EXTS } from "./audio-io";
import { getLinkedProjectDir } from "./linked-projects";
import {
	assertSafePath,
	ensureExtension,
	getFileNameFromPath,
	isLinkedProjectFiles,
	sanitizeFileName,
} from "./manifest";
import {
	getSongInfo,
	pickFolderName,
	resolveProjectName,
} from "./project-naming";
import { saveProject } from "./project-save";
import { upsertRecentProject } from "./recent-projects";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	createProjectPromptAtom,
	dismissedProjectPromptKeyAtom,
	pendingAudioFileAtom,
	pendingAudioPathAtom,
	pendingLyricSourceAtom,
	projectAudioFileAtom,
} from "./state";
import {
	PROJECT_MANIFEST_APP_ID,
	PROJECT_MANIFEST_FILENAME,
	type ProjectManifest,
} from "./types";

async function grantDroppedFileAccess(path: string | null): Promise<void> {
	if (!path) return;
	try {
		await invoke("allow_dropped_file", { path });
	} catch (e) {
		logError("Failed to grant access to the dropped file", e);
	}
}

type Store = ReturnType<typeof getDefaultStore>;
type TFunc = (
	key: string,
	fallback?: string,
	options?: Record<string, unknown>,
) => string;

function getPromptKey(store: Store, audio: File): string {
	const lyric = store.get(lyricLinesAtom);
	const first = lyric.lyricLines[0]?.id ?? "";
	return `${audio.name}:${audio.size}:${lyric.lyricLines.length}:${first}`;
}

export function maybePromptCreateProject(store: Store): void {
	if (!isTauri()) return;
	if (!store.get(folderProjectsEnabledAtom)) return;
	if (store.get(activeProjectDirAtom)) return;
	if (store.get(createProjectPromptAtom)) return;

	const audio = store.get(pendingAudioFileAtom);
	if (!audio) return;
	if (store.get(lyricLinesAtom).lyricLines.length === 0) return;
	if (store.get(dismissedProjectPromptKeyAtom) === getPromptKey(store, audio)) {
		return;
	}
	store.set(createProjectPromptAtom, true);
}

export function dismissCreateProjectPrompt(store: Store): void {
	const audio = store.get(pendingAudioFileAtom);
	if (audio) {
		store.set(dismissedProjectPromptKeyAtom, getPromptKey(store, audio));
	}
	store.set(createProjectPromptAtom, false);
}

export async function createProjectFromCurrent(
	store: Store,
	t: TFunc,
): Promise<boolean> {
	store.set(createProjectPromptAtom, false);
	if (!isTauri()) {
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return false;
	}

	const audio = store.get(pendingAudioFileAtom);
	const lyric = store.get(lyricLinesAtom);
	if (!audio && lyric.lyricLines.length === 0) return false;

	try {
		const parent = await open({
			directory: true,
			multiple: false,
			recursive: true,
			title: t(
				"dialog.createProject.parentTitle",
				"Select where to create the project folder",
			),
			defaultPath: lastFolder("projectParent"),
		});
		if (!parent || typeof parent !== "string") return false;
		rememberPick("projectParent", parent);

		const entries = await readDir(parent);
		const resolved = resolveProjectName({
			metadata: lyric.metadata,
			lyricFileName: store.get(saveFileNameAtom),
			audioFileName: audio?.name,
		});
		const folderName = pickFolderName(
			resolved,
			new Set(entries.map((e) => e.name)),
		);
		const dir = assertSafePath(parent, folderName);
		await mkdir(dir, { recursive: false });

		const manifest: ProjectManifest = {
			version: 1,
			app: PROJECT_MANIFEST_APP_ID,
			projectId: uid(),
			name: resolved.name,
			audioFile: "",
			lyricFile: "",
			folderName,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		store.set(activeProjectDirAtom, dir);
		store.set(activeProjectManifestAtom, manifest);
		store.set(projectAudioFileAtom, audio);

		const saved = await saveProject(store, t);
		if (!saved) {
			store.set(activeProjectDirAtom, null);
			store.set(activeProjectManifestAtom, null);
			return false;
		}
		log(`Created project folder from import: ${folderName}`);
		return true;
	} catch (e) {
		logError("Failed to create project from imported files", e);
		toast.error(
			t("error.folderProjectCreateFailed", "Failed to create project"),
		);
		return false;
	}
}

export async function createLinkedProjectFromCurrent(
	store: Store,
	t: TFunc,
): Promise<boolean> {
	store.set(createProjectPromptAtom, false);
	if (!isTauri()) {
		toast.error(
			t(
				"error.folderProjectRequiresDesktop",
				"The project folder feature is only available in the desktop app",
			),
		);
		return false;
	}

	const audio = store.get(pendingAudioFileAtom);
	const lyric = store.get(lyricLinesAtom);
	if (!audio || lyric.lyricLines.length === 0) {
		log("Skipped linked project: the audio or the lyrics are no longer loaded");
		return false;
	}

	const lyricSource = store.get(pendingLyricSourceAtom);
	const loadedLineIds = new Set(lyricSource?.lineIds);
	const knownLyricPath = lyric.lyricLines.some((line) =>
		loadedLineIds.has(line.id),
	)
		? (lyricSource?.path ?? null)
		: null;

	try {
		const audioPath =
			store.get(pendingAudioPathAtom) ??
			(await open({
				multiple: false,
				directory: false,
				title: t(
					"dialog.linkProject.audioTitle",
					"Select the audio file you loaded",
				),
				filters: [{ name: "Audio", extensions: [...AUDIO_EXTS] }],
				defaultPath: lastFolder("linkAudio"),
			}));
		if (!audioPath || typeof audioPath !== "string") {
			log("Skipped linked project: no audio file was chosen");
			return false;
		}
		rememberPick("linkAudio", audioPath);

		const resolved = resolveProjectName({
			metadata: lyric.metadata,
			lyricFileName: store.get(saveFileNameAtom),
			audioFileName: audio.name,
		});
		const lyricPath =
			knownLyricPath ??
			(await save({
				title: t(
					"dialog.linkProject.lyricTitle",
					"Choose the TTML file this project saves to",
				),
				defaultPath: savePathFor(
					"linkLyrics",
					ensureExtension(
						sanitizeFileName(store.get(saveFileNameAtom) || resolved.name),
						"ttml",
					),
				),
				filters: [{ name: "TTML", extensions: ["ttml"] }],
			}));
		if (!lyricPath) {
			log("Skipped linked project: no TTML file was chosen");
			return false;
		}
		rememberPick("linkLyrics", lyricPath);

		const linked = { lyricPath, audioPath };
		if (!isLinkedProjectFiles(linked)) {
			toast.error(
				t(
					"error.linkedProjectInvalidPath",
					"The selected files cannot be linked. Choose a .ttml file and an audio file on a local drive. Network shares are not supported.",
				),
			);
			return false;
		}

		const projectId = uid();
		const dir = await getLinkedProjectDir(projectId);
		const manifest: ProjectManifest = {
			version: 1,
			app: PROJECT_MANIFEST_APP_ID,
			projectId,
			name: resolved.name,
			audioFile: getFileNameFromPath(audioPath),
			lyricFile: getFileNameFromPath(lyricPath),
			song: getSongInfo(lyric.metadata, audio.size),
			linked,
			createdAt: Date.now(),
			updatedAt: Date.now(),
		};
		// Linking must never touch the user's files: only the manifest owned
		// by the app is written. The TTML is written on the first explicit
		// save, which also keeps a one-time backup of the original.
		try {
			await mkdir(dir, { recursive: true });
			await writeTextFile(
				assertSafePath(dir, PROJECT_MANIFEST_FILENAME),
				JSON.stringify(manifest, null, 2),
			);
		} catch (e) {
			logError("Failed to write linked project manifest", e);
			toast.error(
				t("error.folderProjectCreateFailed", "Failed to create project"),
			);
			return false;
		}
		store.set(activeProjectDirAtom, dir);
		store.set(activeProjectManifestAtom, manifest);
		store.set(projectAudioFileAtom, audio);
		store.set(saveFileNameAtom, getFileNameFromPath(lyricPath));
		await grantDroppedFileAccess(audioPath);
		await grantDroppedFileAccess(knownLyricPath);
		await upsertRecentProject({
			dir,
			name: manifest.name,
			audioFile: manifest.audioFile,
			lyricFile: manifest.lyricFile,
			lastOpened: Date.now(),
			updatedAt: manifest.updatedAt,
			linked: manifest.linked,
		});
		log(`Created linked project: ${manifest.name} (${dir})`);
		return true;
	} catch (e) {
		logError("Failed to create linked project from imported files", e);
		toast.error(
			t("error.folderProjectCreateFailed", "Failed to create project"),
		);
		return false;
	}
}
