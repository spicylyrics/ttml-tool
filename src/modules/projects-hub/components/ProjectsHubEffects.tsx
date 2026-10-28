import { useAtomValue, useStore } from "jotai";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { guideWelcomeOpenAtom } from "$/modules/onboarding/states";
import { getProjectList } from "$/modules/project/autosave/autosave";
import { activeProjectDirAtom } from "$/modules/project/folder-project/state";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import { confirmDialogAtom } from "$/states/dialogs";
import {
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	saveFileNameAtom,
} from "$/states/main";
import { error as logError } from "$/utils/logging";
import { pickSessionToResume, resumeKey } from "../logic/resume-session";
import { rememberSongListProjectDir } from "../song-list-actions";
import { projectsHubEnabledAtom, resumeAnsweredKeyAtom } from "../states";

/** Lets a file opened from the OS, the first-run guide or a migration notice go first. */
const RESUME_DELAY_MS = 1200;

/**
 * App-level side effects of the projects flag: the launch "continue where you
 * left off?" prompt, and linking a started song to the folder project it
 * becomes. Renders nothing.
 */
export const ProjectsHubEffects = () => {
	const { t } = useTranslation();
	const store = useStore();
	const enabled = useAtomValue(projectsHubEnabledAtom);
	const activeDir = useAtomValue(activeProjectDirAtom);
	// Only on launch: turning the flag on later in a session doesn't prompt.
	const launchEnabled = useRef(enabled);
	const prompted = useRef(false);

	useEffect(() => {
		if (enabled && activeDir) rememberSongListProjectDir(store);
	}, [enabled, activeDir, store]);

	useEffect(() => {
		if (!launchEnabled.current || prompted.current) return;
		let cancelled = false;
		const editorBusy = () =>
			store.get(lyricLinesAtom).lyricLines.length > 0 ||
			store.get(activeProjectDirAtom) !== null ||
			store.get(confirmDialogAtom).open ||
			store.get(guideWelcomeOpenAtom);

		const timer = window.setTimeout(async () => {
			if (cancelled || editorBusy()) return;
			let projects: Awaited<ReturnType<typeof getProjectList>>;
			try {
				projects = await getProjectList();
			} catch (e) {
				logError("Failed to read autosaves for the resume prompt", e);
				return;
			}
			const session = pickSessionToResume(
				projects.map((project) => ({
					id: project.id,
					name: project.name,
					lastModified: project.lastModified,
					lineCount: project.latestState.lyricLines.length,
				})),
				{ now: Date.now(), answeredKey: store.get(resumeAnsweredKeyAtom) },
			);
			if (!session || cancelled || editorBusy()) return;
			prompted.current = true;
			const answer = () => store.set(resumeAnsweredKeyAtom, resumeKey(session));
			store.set(confirmDialogAtom, {
				open: true,
				title: t("projectsHub.resume.title", "Continue where you left off?"),
				description: t(
					"projectsHub.resume.description",
					"{name} was last edited on {time}. History restore keeps every autosave either way.",
					{
						name: session.name,
						time: new Date(session.lastModified).toLocaleString(),
					},
				),
				confirmText: t("projectsHub.resume.continue", "Continue"),
				cancelText: t("projectsHub.resume.startFresh", "Start fresh"),
				onConfirm: () => {
					answer();
					// Something may have been opened while the prompt was up.
					if (store.get(lyricLinesAtom).lyricLines.length > 0) return;
					const project = projects.find((item) => item.id === session.id);
					if (!project) return;
					// Same restore as History restore's "latest version".
					store.set(projectIdAtom, project.id);
					store.set(newLyricLinesAtom, project.latestState);
					const suggested = getSuggestedTtmlFileName(
						project.latestState.metadata,
					);
					if (suggested) store.set(saveFileNameAtom, suggested.fileName);
					toast.success(
						t("projectsHub.resume.restored", "Restored {name}.", {
							name: session.name,
						}),
					);
				},
				onCancel: answer,
			});
		}, RESUME_DELAY_MS);
		return () => {
			cancelled = true;
			window.clearTimeout(timer);
		};
	}, [store, t]);

	return null;
};
