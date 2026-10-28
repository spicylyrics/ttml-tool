import type { getDefaultStore } from "jotai";
import { toast } from "react-toastify";
import { uid } from "uid";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	projectAudioFileAtom,
} from "$/modules/project/folder-project/state";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import {
	normalizeChecklistEntries,
	type TTMLChecklistEntry,
} from "$/modules/ttml-checklist/logic";
import { ttmlChecklistAtom } from "$/modules/ttml-checklist/states";
import { confirmDialogAtom, projectsDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
	startFreshLyricDocumentAtom,
} from "$/states/main";
import { error as logError } from "$/utils/logging";
import {
	linkEntryToProject,
	linkEntryToProjectDir,
	markExportedEntryDone,
	songListMetadata,
} from "./logic/song-list";
import {
	type ProjectsDialogTab,
	projectsDialogTabRequestAtom,
	projectsHubEnabledAtom,
} from "./states";

type Store = ReturnType<typeof getDefaultStore>;
type TFunc = (
	key: string,
	fallback?: string,
	options?: Record<string, unknown>,
) => string;

const readEntries = (store: Store) =>
	normalizeChecklistEntries(store.get(ttmlChecklistAtom));

/** Opens the Projects window, optionally on a given tab. */
export function openProjectsDialog(
	store: Store,
	tab?: ProjectsDialogTab,
): void {
	if (tab) store.set(projectsDialogTabRequestAtom, tab);
	store.set(projectsDialogAtom, true);
}

/**
 * Starts a fresh document for a song list entry: title and artist filled in,
 * no folder project, a new autosave id that the entry remembers so exporting
 * the document marks it done. Asks first when there are unsaved changes.
 */
export function startSongListProject(
	store: Store,
	entry: TTMLChecklistEntry,
	t: TFunc,
	onStarted?: () => void,
): void {
	const start = () => {
		const metadata = songListMetadata(entry);
		const projectId = uid();
		store.set(newLyricLinesAtom, { lyricLines: [], metadata });
		store.set(startFreshLyricDocumentAtom);
		// Same reset as File > New: never inherit the open folder project.
		store.set(activeProjectDirAtom, null);
		store.set(activeProjectManifestAtom, null);
		store.set(projectAudioFileAtom, null);
		store.set(projectIdAtom, projectId);
		store.set(
			saveFileNameAtom,
			getSuggestedTtmlFileName(metadata, { allowPartial: true })?.fileName ??
				"lyric.ttml",
		);
		store.set(
			ttmlChecklistAtom,
			linkEntryToProject(readEntries(store), entry.id, projectId),
		);
		onStarted?.();
		toast.success(
			t(
				"projectsHub.songs.started",
				"Started {song}. Import or type the lyrics, then load the audio.",
				{ song: entry.song },
			),
		);
	};

	if (!store.get(isDirtyAtom)) {
		start();
		return;
	}
	store.set(confirmDialogAtom, {
		open: true,
		title: t("confirmDialog.newFile.title", "Start new lyrics?"),
		description: t(
			"projectsHub.songs.startDirty",
			"You have unsaved changes. Starting {song} replaces the lyrics in the editor.",
			{ song: entry.song },
		),
		onConfirm: start,
	});
}

/** Remembers the folder project a started document was saved as. */
export function rememberSongListProjectDir(store: Store): void {
	const dir = store.get(activeProjectDirAtom);
	if (!dir) return;
	const entries = readEntries(store);
	const next = linkEntryToProjectDir(entries, store.get(projectIdAtom), dir);
	if (next !== entries) store.set(ttmlChecklistAtom, next);
}

/**
 * After a TTML export: if the document was started from the song list, mark
 * that entry done. Does nothing while the feature flag is off.
 */
export function markSongListExported(store: Store, t?: TFunc): void {
	try {
		if (!store.get(projectsHubEnabledAtom)) return;
		const result = markExportedEntryDone(readEntries(store), {
			projectId: store.get(projectIdAtom),
			projectDir: store.get(activeProjectDirAtom),
			metadata: store.get(lyricLinesAtom).metadata,
		});
		if (!result.entry) return;
		store.set(ttmlChecklistAtom, result.entries);
		const message = t
			? t("projectsHub.songs.markedDone", "Marked {song} as done.", {
					song: result.entry.song,
				})
			: `Marked ${result.entry.song} as done.`;
		toast.success(message);
	} catch (e) {
		// Bookkeeping must never turn a successful save into a failure.
		logError("Failed to update the song list after export", e);
	}
}
