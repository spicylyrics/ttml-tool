import type { Atom, getDefaultStore } from "jotai";
import { toast } from "react-toastify";
import { audioEngine } from "$/modules/audio/audio-engine";
import { currentTimeAtom } from "$/modules/audio/states";
import { readTranslationExportOptions } from "$/modules/romanization/states";
import {
	allowConsecutiveBackgroundLinesAtom,
	lyricTextNormalizationOptionsAtom,
} from "$/modules/settings/states";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	lyricLinesAtom,
	markLyricsSavedAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main";
import { saveFile } from "$/utils/fileSystem";
import { error } from "$/utils/logging";
import { saveLyricsOnly, saveProject } from "./folder-project/project-save";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
} from "./folder-project/state";
import {
	type PreparedTTML,
	produceTTMLText,
	reviewTTMLExport,
} from "./logic/ttml-export";
import { getTTMLSaveName } from "./logic/ttml-save-name";

type Store = ReturnType<typeof getDefaultStore>;
export type ExportTranslation = (
	key: string,
	fallback?: string,
	options?: Record<string, unknown>,
) => string;

function optionalRead<T>(
	store: Store,
	atom: Atom<T>,
	recovery: boolean,
): T | undefined {
	try {
		return store.get(atom);
	} catch (e) {
		if (!recovery) throw e;
		return undefined;
	}
}

/** No promise waits for a React confirmation dialog. The confirmed callback
 * carries the exact snapshot that was reviewed, even if edits arrive meanwhile.
 * Recovery emits the same warnings and proceeds without the unmounted dialogs.
 */
export async function withTTMLExport(
	store: Store,
	t: ExportTranslation,
	write: (prepared: PreparedTTML) => Promise<boolean>,
	{
		recovery = false,
		onWarning,
	}: { recovery?: boolean; onWarning?: (message: string) => void } = {},
): Promise<boolean> {
	try {
		const lyric = store.get(lyricLinesAtom);
		let review: ReturnType<typeof reviewTTMLExport> = {
			untimed: undefined,
		};
		try {
			review = reviewTTMLExport(lyric);
		} catch (e) {
			if (!recovery) throw e;
			error("Recovery validation failed; attempting TTML serialization", e);
			onWarning?.(
				t(
					"export.recoveryReviewFailed",
					"Timing checks could not run. Review the recovered lyrics before submitting.",
				),
			);
		}
		const notify = (message: string) => {
			if (recovery) onWarning?.(message);
			try {
				toast.info(message);
			} catch (e) {
				error(message, e);
			}
		};
		const execute = async () => {
			try {
				return await write({
					lyric,
					text: produceTTMLText(
						lyric,
						optionalRead(store, lyricTextNormalizationOptionsAtom, recovery),
						{
							allowConsecutiveBackgroundLines:
								optionalRead(
									store,
									allowConsecutiveBackgroundLinesAtom,
									recovery,
								) ?? (recovery ? true : undefined),
							...readTranslationExportOptions(store),
						},
					),
				});
			} catch (e) {
				error("Failed to export TTML", e);
				notify(t("error.ttmlGenerateFailed", "Failed to generate TTML"));
				return false;
			}
		};
		if (review.untimed) {
			const { line, unit } = review.untimed;
			const description = t(
				"confirmDialog.untimedLyrics.description",
				"Some lines or words have no timing yet. Fix them, or export anyway?",
			);
			if (recovery)
				notify(
					t(
						"export.recoveryUntimed",
						"This recovery export contains untimed lyrics. Check timing before submitting.",
					),
				);
			else {
				store.set(confirmDialogAtom, {
					open: true,
					title: t("confirmDialog.untimedLyrics.title", "Untimed lyrics found"),
					description,
					confirmText: t(
						"confirmDialog.untimedLyrics.exportAnyway",
						"Export anyway",
					),
					cancelText: t("confirmDialog.untimedLyrics.fixIt", "Fix it"),
					onConfirm: () => {
						void execute();
					},
					onCancel: () => {
						store.set(selectedLinesAtom, new Set([line.id]));
						store.set(selectedWordsAtom, new Set([unit.id]));
						audioEngine.seekMusic(line.startTime / 1000);
						store.set(currentTimeAtom, line.startTime);
					},
				});
				return false;
			}
		}
		return await execute();
	} catch (e) {
		error("Failed to prepare TTML export", e);
		return false;
	}
}

export function saveTTML(
	store: Store,
	t: ExportTranslation,
	options: {
		recovery?: boolean;
		project?: boolean;
		onSaved?: () => void;
		onWarning?: (message: string) => void;
	} = {},
): Promise<boolean> {
	const recovery = options.recovery ?? false;
	return withTTMLExport(
		store,
		t,
		async (prepared) => {
			if (options.project)
				return saveProject(store, t, { prepared, onSaved: options.onSaved });
			const dir = optionalRead(store, activeProjectDirAtom, recovery);
			const manifest = optionalRead(store, activeProjectManifestAtom, recovery);
			if (dir && manifest) {
				let saved = false;
				let shouldFallback = false;
				try {
					shouldFallback = await saveLyricsOnly(store, t, {
						prepared,
						onSaved: () => {
							saved = true;
						},
					});
				} catch (e) {
					if (!recovery) throw e;
					error("Project recovery save failed", e);
				}
				if (saved) {
					options.onSaved?.();
					return true;
				}
				if (!recovery && !shouldFallback) return false;
				// A broken project/filesystem must not prevent rescuing a standalone copy.
			}
			const existingName = optionalRead(store, saveFileNameAtom, recovery);
			const suggestedName = getTTMLSaveName(
				prepared.lyric,
				existingName,
				manifest,
			);
			const savedName = await saveFile(prepared.text, {
				suggestedName,
				types: [
					{
						description: "TTML Files",
						accept: { "application/ttml+xml": [".ttml"] },
					},
				],
			});
			if (!savedName) return false;
			// Recovery can rescue a file even when optional state bookkeeping is broken.
			try {
				store.set(saveFileNameAtom, savedName);
				store.set(markLyricsSavedAtom, prepared.lyric);
			} catch (e) {
				if (!recovery) throw e;
				error("Recovered TTML, but could not update saved state", e);
			}
			options.onSaved?.();
			return true;
		},
		options,
	);
}

export function copyTTML(store: Store, t: ExportTranslation): Promise<boolean> {
	return withTTMLExport(store, t, async ({ text }) => {
		await navigator.clipboard.writeText(text);
		return true;
	});
}
