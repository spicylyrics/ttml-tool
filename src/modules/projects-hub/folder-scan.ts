import { isTauri } from "@tauri-apps/api/core";
import { join } from "@tauri-apps/api/path";
import { mkdir, readDir, writeTextFile } from "@tauri-apps/plugin-fs";
import { uid } from "uid";
import {
	getLinkedProjectDir,
	listLinkedProjects,
} from "$/modules/project/folder-project/linked-projects";
import {
	assertSafePath,
	isLinkedProjectFiles,
} from "$/modules/project/folder-project/manifest";
import { upsertRecentProject } from "$/modules/project/folder-project/recent-projects";
import {
	PROJECT_MANIFEST_APP_ID,
	PROJECT_MANIFEST_FILENAME,
	type ProjectManifest,
} from "$/modules/project/folder-project/types";
import { AUDIO_EXTENSIONS } from "$/utils/audio-formats";
import { log, error as logError } from "$/utils/logging";
import {
	findLinkablePairs,
	type LinkablePair,
	withoutLinkedPaths,
} from "./logic/linkable-pairs";

/** Same cap as the workspace scan, so a huge folder can't stall the window. */
const MAX_SUBFOLDERS = 100;

export interface FolderPair extends LinkablePair {
	dir: string;
	lyricPath: string;
	audioPath: string;
}

type DirEntries = Awaited<ReturnType<typeof readDir>>;

async function pairsIn(
	dir: string,
	entries: DirEntries,
): Promise<FolderPair[]> {
	const files = entries.filter((entry) => entry.isFile).map((e) => e.name);
	return Promise.all(
		findLinkablePairs(files, AUDIO_EXTENSIONS).map(async (pair) => ({
			...pair,
			dir,
			lyricPath: await join(dir, pair.lyricFile),
			audioPath: await join(dir, pair.audioFile),
		})),
	);
}

/**
 * Finds same-name `.ttml` + audio files in a folder and its direct subfolders,
 * the way files were kept before projects existed. Folders that already are
 * projects and TTMLs that are already linked are left out.
 */
export async function scanFolderForPairs(
	rootDir: string,
): Promise<FolderPair[]> {
	if (!isTauri() || !rootDir) return [];
	let entries: DirEntries;
	try {
		entries = await readDir(rootDir);
	} catch (e) {
		logError("Failed to read the folder to scan for TTMLs", e);
		return [];
	}
	const found = await pairsIn(rootDir, entries);
	const subfolders = entries
		.filter((entry) => entry.isDirectory && !entry.name.startsWith("."))
		.slice(0, MAX_SUBFOLDERS);
	for (const folder of subfolders) {
		try {
			const dir = await join(rootDir, folder.name);
			const subEntries = await readDir(dir);
			if (
				subEntries.some((e) => e.isFile && e.name === PROJECT_MANIFEST_FILENAME)
			)
				continue;
			found.push(...(await pairsIn(dir, subEntries)));
		} catch {}
	}
	const linked = await listLinkedProjects().catch(() => []);
	return withoutLinkedPaths(
		found,
		linked.map((entry) => entry.manifest.linked.lyricPath),
	);
}

/**
 * Links a pair as a project without opening it: only the app-owned manifest is
 * written, the TTML and audio stay where they are and aren't touched.
 */
export async function linkPairAsProject(
	pair: FolderPair,
): Promise<string | null> {
	const linked = { lyricPath: pair.lyricPath, audioPath: pair.audioPath };
	if (!isLinkedProjectFiles(linked)) {
		log(`Skipped linking ${pair.lyricPath}: the paths can't be linked`);
		return null;
	}
	const projectId = uid();
	const dir = await getLinkedProjectDir(projectId);
	const now = Date.now();
	const manifest: ProjectManifest = {
		version: 1,
		app: PROJECT_MANIFEST_APP_ID,
		projectId,
		name: pair.name || pair.lyricFile,
		audioFile: pair.audioFile,
		lyricFile: pair.lyricFile,
		linked,
		createdAt: now,
		updatedAt: now,
	};
	await mkdir(dir, { recursive: true });
	await writeTextFile(
		assertSafePath(dir, PROJECT_MANIFEST_FILENAME),
		JSON.stringify(manifest, null, 2),
	);
	// No scope grant needed: both files sit under the folder picked for the scan,
	// which the dialog already granted (and the persisted scope keeps).
	await upsertRecentProject({
		dir,
		name: manifest.name,
		audioFile: manifest.audioFile,
		lyricFile: manifest.lyricFile,
		lastOpened: now,
		updatedAt: now,
		linked,
	});
	log(`Linked ${pair.lyricPath} as a project (${dir})`);
	return dir;
}
