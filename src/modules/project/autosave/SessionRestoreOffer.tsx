import {
	ArrowUndoRegular,
	DismissRegular,
	MusicNote2Regular,
} from "@fluentui/react-icons";
import { Button, Checkbox, Flex, Text } from "@radix-ui/themes";
import { isTauri } from "@tauri-apps/api/core";
import { useAtom, useStore } from "jotai";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useLoadAudio } from "$/hooks/useLoadAudio";
import {
	getProjectList,
	markProjectSaved,
	type ProjectInfo,
} from "$/modules/project/autosave/autosave";
import { readAudioFileAt } from "$/modules/project/folder-project/audio-io";
import {
	autosaveEnabledAtom,
	restoreSessionAutomaticallyAtom,
} from "$/modules/settings/states";
import {
	lyricLinesAtom,
	newLyricLinesAtom,
	projectIdAtom,
	savedLyricLinesAtom,
	saveFileNameAtom,
} from "$/states/main";
import { error as logError } from "$/utils/logging";

const TOAST_ID = "restore-last-session";
const AUDIO_TOAST_ID = "restore-last-session-audio";

/** Desktop only: lets the prompt turn itself off, mirrored in Preferences. */
const AlwaysRestoreCheckbox = () => {
	const { t } = useTranslation();
	const [value, setValue] = useAtom(restoreSessionAutomaticallyAtom);
	return (
		<Text as="label" size="1">
			<Flex gap="2" align="center">
				<Checkbox
					checked={value}
					onCheckedChange={(next) => setValue(next === true)}
				/>
				{t("sessionRestore.always", "Always restore automatically")}
			</Flex>
		</Text>
	);
};

/**
 * After a reload the editor starts empty even though autosave kept the work.
 * When the last session ended with unsaved changes, offer to bring it back:
 * lyrics, file name and audio. Audio only returns when the file can still be
 * read (desktop, picked through a native dialog); otherwise it asks for it.
 */
export const SessionRestoreOffer = () => {
	const { t } = useTranslation();
	const store = useStore();
	const { openAudioFile, loadAudio } = useLoadAudio();
	// The mount effect runs once, so it reads the current hook values from here.
	const audio = useRef({ openAudioFile, loadAudio, t });
	audio.current = { openAudioFile, loadAudio, t };

	// biome-ignore lint/correctness/useExhaustiveDependencies: once per page load
	useEffect(() => {
		let cancelled = false;

		const askForAudio = (name: string | undefined) => {
			const { loadAudio, t } = audio.current;
			toast.info(
				({ closeToast }) => (
					<Flex direction="column" gap="2">
						<Text size="2">
							{name
								? t(
										"sessionRestore.audioNamed",
										"Your lyrics are back. Load {name} again to keep syncing.",
										{ name },
									)
								: t(
										"sessionRestore.audio",
										"Your lyrics are back. Load the audio again to keep syncing.",
									)}
						</Text>
						<Flex gap="2" wrap="wrap">
							<Button
								size="1"
								onClick={() => {
									void loadAudio();
									closeToast();
								}}
							>
								<MusicNote2Regular />
								{t("sessionRestore.chooseAudio", "Choose audio")}
							</Button>
							<Button
								size="1"
								variant="soft"
								color="gray"
								onClick={() => closeToast()}
							>
								{t("sessionRestore.later", "Later")}
							</Button>
						</Flex>
					</Flex>
				),
				{ toastId: AUDIO_TOAST_ID, autoClose: false, closeOnClick: false },
			);
		};

		const restore = async (project: ProjectInfo) => {
			if (store.get(lyricLinesAtom).lyricLines.length > 0) return;
			store.set(projectIdAtom, project.id);
			store.set(newLyricLinesAtom, project.latestState);
			// An empty baseline keeps the restored work counted as unsaved.
			store.set(savedLyricLinesAtom, { lyricLines: [], metadata: [] });
			if (project.fileName) store.set(saveFileNameAtom, project.fileName);

			if (!project.audioPath && !project.audioName) return;
			const file = project.audioPath
				? await readAudioFileAt(project.audioPath)
				: null;
			if (file) await audio.current.openAudioFile(file);
			else askForAudio(project.audioName);
		};

		(async () => {
			if (!store.get(autosaveEnabledAtom)) return;
			try {
				const latest = (await getProjectList()).find(
					(p) =>
						p.unsaved !== false &&
						p.id !== "legacy_autosave_archive" &&
						p.latestState.lyricLines.length > 0,
				);
				if (cancelled || !latest) return;
				if (store.get(lyricLinesAtom).lyricLines.length > 0) return;

				if (isTauri() && store.get(restoreSessionAutomaticallyAtom)) {
					await restore(latest);
					toast.info(
						audio.current.t(
							"sessionRestore.auto",
							"Restored your unsaved work from last time.",
						),
					);
					return;
				}

				const { t } = audio.current;
				toast.info(
					({ closeToast }) => (
						<Flex direction="column" gap="2">
							<Text size="2" weight="medium">
								{t("sessionRestore.title", "Pick up where you left off?")}
							</Text>
							<Text size="2">
								{t(
									"sessionRestore.note",
									"Your last autosaved lyrics are still here: {name}.",
									{ name: latest.name },
								)}
							</Text>
							{isTauri() && <AlwaysRestoreCheckbox />}
							<Flex gap="2" wrap="wrap">
								<Button
									size="1"
									onClick={() => {
										closeToast();
										void restore(latest).catch((e) =>
											logError("Failed to restore the last session", e),
										);
									}}
								>
									<ArrowUndoRegular />
									{t("sessionRestore.restore", "Restore")}
								</Button>
								<Button
									size="1"
									variant="soft"
									color="gray"
									onClick={() => {
										void markProjectSaved(latest.id);
										closeToast();
									}}
								>
									<DismissRegular />
									{t("sessionRestore.dismiss", "Start fresh")}
								</Button>
							</Flex>
						</Flex>
					),
					{ toastId: TOAST_ID, autoClose: false, closeOnClick: false },
				);
			} catch (e) {
				logError("Failed to look for an autosaved session", e);
			}
		})();
		return () => {
			cancelled = true;
		};
	}, []);

	return null;
};
