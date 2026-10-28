import {
	DocumentRegular,
	FolderOpenRegular,
	MusicNote1Regular,
	Play16Regular,
	TaskListLtr24Regular,
} from "@fluentui/react-icons";
import { Button, Flex, Grid, Heading, Text } from "@radix-ui/themes";
import { isTauri } from "@tauri-apps/api/core";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useTopMenuActions } from "$/components/TopMenu/useTopMenuActions";
import { openImportLyricsAtom } from "$/modules/lyrics-import/states";
import {
	guidePanelOpenAtom,
	guideStepAtom,
	guideWelcomeOpenAtom,
} from "$/modules/onboarding/states";
import {
	getRecentProjects,
	type RecentProjectEntry,
} from "$/modules/project/folder-project/recent-projects";
import { useFolderProject } from "$/modules/project/folder-project/useFolderProject";
import { folderProjectsEnabledAtom } from "$/modules/settings/states";
import { normalizeChecklistEntries } from "$/modules/ttml-checklist/logic";
import { ttmlChecklistAtom } from "$/modules/ttml-checklist/states";
import { lyricLinesAtom } from "$/states/main";
import { openProjectsDialog, startSongListProject } from "../song-list-actions";
import styles from "./StartScreen.module.css";

const LIST_LIMIT = 4;

/**
 * The empty editor with the projects flag on: recent projects, the song list
 * and the ways to start, instead of a bare "no lyric lines" note.
 */
export const StartScreen = () => {
	const { t } = useTranslation();
	const actionT = useCallback(
		(key: string, fallback?: string, options?: Record<string, unknown>) =>
			t(key, fallback ?? key, options),
		[t],
	);
	const store = useStore();
	const { onOpenFile } = useTopMenuActions();
	const { openProject, openProjectFromDir } = useFolderProject();
	const openImport = useSetAtom(openImportLyricsAtom);
	const setGuideWelcome = useSetAtom(guideWelcomeOpenAtom);
	const setGuidePanel = useSetAtom(guidePanelOpenAtom);
	const setGuideStep = useSetAtom(guideStepAtom);
	const folderProjectsEnabled = useAtomValue(folderProjectsEnabledAtom);
	const storedSongs = useAtomValue(ttmlChecklistAtom);
	const songs = useMemo(
		() =>
			normalizeChecklistEntries(storedSongs)
				.filter((entry) => !entry.completed)
				.slice(0, LIST_LIMIT),
		[storedSongs],
	);
	// After Start project the editor has a title but no lines yet.
	const metadata = useAtomValue(lyricLinesAtom).metadata;
	const startedSong =
		metadata
			.find((item) => item.key === "musicName")
			?.value.find((value) => value.trim()) ?? "";
	const desktop = isTauri();
	const [recent, setRecent] = useState<RecentProjectEntry[]>([]);

	useEffect(() => {
		if (!desktop) return;
		let cancelled = false;
		getRecentProjects().then((list) => {
			if (!cancelled) setRecent(list.slice(0, LIST_LIMIT));
		});
		return () => {
			cancelled = true;
		};
	}, [desktop]);

	const hasLists = recent.length > 0 || songs.length > 0;

	return (
		<Flex direction="column" gap="5" className={styles.screen}>
			<Flex direction="column" gap="1" align="center">
				<Heading size="5" align="center" style={{ letterSpacing: "-0.014em" }}>
					{startedSong || t("projectsHub.start.title", "Start syncing")}
				</Heading>
				<Text color="gray" align="center">
					{startedSong
						? t(
								"projectsHub.start.startedDescription",
								"Add the lyrics from text or Genius, then load the audio.",
							)
						: t(
								"projectsHub.start.description",
								"Open a project, pick a song from your list, or start from lyrics.",
							)}
				</Text>
			</Flex>

			<Grid columns="3" gap="2" className={styles.actions}>
				<Button onClick={() => openImport("plainText")}>
					{t("projectsHub.start.fromText", "New from text")}
				</Button>
				<Button variant="soft" onClick={() => openImport("genius")}>
					{t("projectsHub.start.fromGenius", "New from Genius")}
				</Button>
				<Button variant="soft" onClick={onOpenFile}>
					{t("projectsHub.start.openFile", "Open file...")}
				</Button>
				{desktop && folderProjectsEnabled && (
					<Button variant="outline" onClick={() => void openProject()}>
						<FolderOpenRegular />
						{t("projectsHub.start.openFolder", "Open folder project...")}
					</Button>
				)}
				<Button variant="outline" onClick={() => openProjectsDialog(store)}>
					{t("projectsHub.start.projects", "Projects...")}
				</Button>
				<Button
					variant="outline"
					onClick={() => {
						setGuideStep(0);
						setGuidePanel(false);
						setGuideWelcome(true);
					}}
				>
					{t("beginnerGuide.empty.start", "Start guide")}
				</Button>
			</Grid>

			{hasLists && (
				<Grid
					columns={recent.length > 0 && songs.length > 0 ? "2" : "1"}
					gap="4"
				>
					{recent.length > 0 && (
						<Flex direction="column" gap="2" className={styles.list}>
							<Flex justify="between" align="center">
								<Text size="2" weight="medium">
									{t("projectsHub.start.recent", "Recent projects")}
								</Text>
								<Button
									size="1"
									variant="ghost"
									onClick={() => openProjectsDialog(store, "recent")}
								>
									{t("projectsHub.start.seeAll", "See all")}
								</Button>
							</Flex>
							{recent.map((project) => (
								<button
									type="button"
									key={project.dir}
									className={styles.row}
									onClick={() => void openProjectFromDir(project.dir)}
								>
									<DocumentRegular aria-hidden="true" />
									<Flex direction="column" minWidth="0">
										<Text size="2" weight="medium" truncate>
											{project.name}
										</Text>
										{project.audioFile && (
											<Text size="1" color="gray" truncate>
												<MusicNote1Regular aria-hidden="true" />{" "}
												{project.audioFile}
											</Text>
										)}
									</Flex>
								</button>
							))}
						</Flex>
					)}
					{songs.length > 0 && (
						<Flex direction="column" gap="2" className={styles.list}>
							<Flex justify="between" align="center">
								<Text size="2" weight="medium">
									{t("projectsHub.start.songs", "To sync")}
								</Text>
								<Button
									size="1"
									variant="ghost"
									onClick={() => openProjectsDialog(store, "songs")}
								>
									{t("projectsHub.start.seeAll", "See all")}
								</Button>
							</Flex>
							{songs.map((entry) => (
								<div key={entry.id} className={styles.row}>
									<TaskListLtr24Regular
										aria-hidden="true"
										style={{ flexShrink: 0, fontSize: 16 }}
									/>
									<Flex direction="column" minWidth="0" flexGrow="1">
										<Text size="2" weight="medium" truncate>
											{entry.song}
										</Text>
										{entry.artist && (
											<Text size="1" color="gray" truncate>
												{entry.artist}
											</Text>
										)}
									</Flex>
									<Button
										size="1"
										variant="soft"
										onClick={() => startSongListProject(store, entry, actionT)}
										aria-label={t(
											"projectsHub.start.startSong",
											"Start project for {song}",
											{ song: entry.song },
										)}
									>
										<Play16Regular />
										{t("projectsHub.songs.start", "Start project")}
									</Button>
								</div>
							))}
						</Flex>
					)}
				</Grid>
			)}
		</Flex>
	);
};
