import {
	ClockRegular,
	DeleteRegular,
	DocumentRegular,
	FolderOpenRegular,
	LinkRegular,
	MusicNote1Regular,
	SaveRegular,
	SearchRegular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Dialog,
	Flex,
	IconButton,
	ScrollArea,
	Tabs,
	Text,
	TextField,
} from "@radix-ui/themes";
import { invoke, isTauri } from "@tauri-apps/api/core";
import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	getLinkedBackupInfo,
	type LinkedBackupInfo,
} from "$/modules/project/folder-project/linked-backup";
import {
	type LinkedProjectEntry,
	listLinkedProjects,
	removeLinkedProject,
} from "$/modules/project/folder-project/linked-projects";
import {
	getRecentProjectFileStatus,
	getRecentProjects,
	type RecentProjectEntry,
	type RecentProjectFileStatus,
	removeRecentProject,
} from "$/modules/project/folder-project/recent-projects";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	projectAudioFileAtom,
	workspaceDirAtom,
	workspaceProjectsAtom,
	workspaceScanningAtom,
} from "$/modules/project/folder-project/state";
import { useFolderProject } from "$/modules/project/folder-project/useFolderProject";
import { LinkableFilesPanel } from "$/modules/projects-hub/components/LinkableFilesPanel";
import { SongListTab } from "$/modules/projects-hub/components/SongListTab";
import {
	type ProjectsDialogTab,
	projectsDialogTabRequestAtom,
	projectsHubEnabledAtom,
} from "$/modules/projects-hub/states";
import { confirmDialogAtom, projectsDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import { error as logError } from "$/utils/logging";
import styles from "./ProjectsDialog.module.css";

type Tab = ProjectsDialogTab;
const RelativeTime = ({ timestamp }: { timestamp: number }) => {
	const { t } = useTranslation();
	if (timestamp === 0) return t("workspace.unknown", "Unknown");
	const diff = Date.now() - timestamp;
	const minutes = Math.floor(diff / 60000);
	const hours = Math.floor(minutes / 60);
	const days = Math.floor(hours / 24);
	if (days > 0)
		return t(
			"time.daysAgo",
			"{count, plural, one {# day ago} other {# days ago}}",
			{ count: days },
		);
	if (hours > 0)
		return t(
			"time.hoursAgo",
			"{count, plural, one {# hour ago} other {# hours ago}}",
			{ count: hours },
		);
	if (minutes > 0)
		return t(
			"time.minutesAgo",
			"{count, plural, one {# minute ago} other {# minutes ago}}",
			{ count: minutes },
		);
	return t("time.justNow", "just now");
};

const matchesQuery = (query: string, ...fields: (string | undefined)[]) => {
	const needle = query.trim().toLowerCase();
	return (
		!needle || fields.some((field) => field?.toLowerCase().includes(needle))
	);
};

const FileBadge = ({
	kind,
	name,
	missing,
}: {
	kind: "lyric" | "audio";
	name: string;
	missing: boolean;
}) => {
	const { t } = useTranslation();
	const Icon = kind === "lyric" ? DocumentRegular : MusicNote1Regular;
	return (
		<Badge variant="soft" color={missing ? "red" : undefined}>
			<Icon fontSize={10} />{" "}
			{name
				? missing
					? t("projectBrowser.fileMissing", "{file} (missing)", { file: name })
					: name
				: kind === "lyric"
					? t("projectBrowser.noLyric", "No lyrics")
					: t("projectBrowser.noAudio", "No audio")}
		</Badge>
	);
};

const LinkedBadge = () => {
	const { t } = useTranslation();
	return (
		<Badge variant="soft" color="iris">
			<LinkRegular fontSize={10} />{" "}
			{t("projectsDialog.linkedBadge", "Linked files")}
		</Badge>
	);
};

export const ProjectsDialog = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(projectsDialogAtom);
	const [activeTab, setActiveTab] = useState<Tab>("project");
	const [query, setQuery] = useState("");
	const hubEnabled = useAtomValue(projectsHubEnabledAtom);
	const [tabRequest, setTabRequest] = useAtom(projectsDialogTabRequestAtom);

	useEffect(() => {
		if (!isOpen || !tabRequest) return;
		if (tabRequest !== "songs" || hubEnabled) setActiveTab(tabRequest);
		setTabRequest(null);
	}, [isOpen, tabRequest, hubEnabled, setTabRequest]);

	useEffect(() => {
		if (!hubEnabled && activeTab === "songs") setActiveTab("project");
	}, [hubEnabled, activeTab]);

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content
				style={{
					width: 720,
					maxWidth: "90vw",
					maxHeight: "80vh",
					display: "flex",
					flexDirection: "column",
				}}
			>
				<Dialog.Title>{t("projectsDialog.title", "Projects")}</Dialog.Title>

				<Tabs.Root
					value={activeTab}
					onValueChange={(v) => setActiveTab(v as Tab)}
				>
					<Tabs.List style={{ marginBottom: 16 }}>
						<Tabs.Trigger value="project" className={styles.tabTrigger}>
							{t("projectsDialog.tabProject", "Project")}
						</Tabs.Trigger>
						<Tabs.Trigger value="recent" className={styles.tabTrigger}>
							{t("projectsDialog.tabRecent", "Recent")}
						</Tabs.Trigger>
						<Tabs.Trigger value="linked" className={styles.tabTrigger}>
							{t("projectsDialog.tabLinked", "Linked")}
						</Tabs.Trigger>
						<Tabs.Trigger value="workspace" className={styles.tabTrigger}>
							{hubEnabled
								? t("projectsHub.scan.tab", "Scan folder")
								: t("projectsDialog.tabWorkspace", "Workspace")}
						</Tabs.Trigger>
						{hubEnabled && (
							<Tabs.Trigger value="songs" className={styles.tabTrigger}>
								{t("projectsHub.tabSongs", "To sync")}
							</Tabs.Trigger>
						)}
					</Tabs.List>

					{activeTab !== "project" && activeTab !== "songs" && (
						<TextField.Root
							value={query}
							onChange={(e) => setQuery(e.target.value)}
							placeholder={t(
								"projectsDialog.searchPlaceholder",
								"Search by name or location",
							)}
							mb="3"
						>
							<TextField.Slot>
								<SearchRegular />
							</TextField.Slot>
						</TextField.Root>
					)}

					<Box style={{ flexGrow: 1, overflow: "hidden", minHeight: 420 }}>
						<Tabs.Content value="project" className={styles.tabContent}>
							<ProjectTab onClose={() => setIsOpen(false)} />
						</Tabs.Content>
						<Tabs.Content value="recent" className={styles.tabContent}>
							<RecentTab query={query} onClose={() => setIsOpen(false)} />
						</Tabs.Content>
						<Tabs.Content value="linked" className={styles.tabContent}>
							<LinkedTab query={query} onClose={() => setIsOpen(false)} />
						</Tabs.Content>
						<Tabs.Content value="workspace" className={styles.tabContent}>
							<WorkspaceTab query={query} onClose={() => setIsOpen(false)} />
						</Tabs.Content>
						{hubEnabled && (
							<Tabs.Content value="songs" className={styles.tabContent}>
								<SongListTab onClose={() => setIsOpen(false)} />
							</Tabs.Content>
						)}
					</Box>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
};

const ProjectTab = ({ onClose }: { onClose: () => void }) => {
	const { t } = useTranslation();
	const activeDir = useAtomValue(activeProjectDirAtom);
	const manifest = useAtomValue(activeProjectManifestAtom);
	const lyricLines = useAtomValue(lyricLinesAtom);
	const projectAudioFile = useAtomValue(projectAudioFileAtom);
	const { createProject, saveProject, renameProject, openProject } =
		useFolderProject();
	const [projectName, setProjectName] = useState("");

	useEffect(() => {
		setProjectName(manifest?.name || "");
	}, [manifest]);

	const hasAudio = projectAudioFile !== null || Boolean(manifest?.audioFile);
	const hasLyric = lyricLines.lyricLines.length > 0;
	const linked = manifest?.linked;

	const handleSave = useCallback(async () => {
		const trimmed = projectName.trim();
		if (trimmed && trimmed !== manifest?.name) {
			await renameProject(trimmed);
		}
		await saveProject();
		onClose();
	}, [saveProject, renameProject, projectName, manifest, onClose]);

	const handleBrowse = useCallback(() => {
		onClose();
		openProject();
	}, [openProject, onClose]);

	const handleCreate = useCallback(async () => {
		onClose();
		await createProject();
	}, [createProject, onClose]);

	if (!activeDir) {
		return (
			<Flex
				direction="column"
				align="center"
				justify="center"
				gap="3"
				style={{ minHeight: 200 }}
			>
				<Text color="gray">
					{t("projectsDialog.noProject", "No project is currently open")}
				</Text>
				<Flex gap="2">
					<Button variant="soft" onClick={handleCreate}>
						{t("projectsDialog.createNew", "New project")}
					</Button>
					<Button variant="soft" onClick={handleBrowse}>
						<FolderOpenRegular />{" "}
						{t("projectsDialog.openFolder", "Open folder")}
					</Button>
				</Flex>
			</Flex>
		);
	}

	return (
		<Flex direction="column" gap="3">
			<Flex gap="2" align="center">
				<TextField.Root
					value={projectName}
					onChange={(e) => setProjectName(e.target.value)}
					style={{ flexGrow: 1 }}
				/>
				<Badge
					variant="soft"
					style={{
						backgroundColor: "var(--accent-4)",
						color: "var(--accent-11)",
					}}
				>
					v{manifest?.version || 1}
				</Badge>
			</Flex>
			<Flex gap="2" align="center" wrap="wrap">
				{linked ? (
					<LinkedBadge />
				) : (
					<Badge variant="soft" color="gray">
						<FolderOpenRegular fontSize={10} />{" "}
						{t("projectsDialog.folderBadge", "Project folder")}
					</Badge>
				)}
				<Text size="1" color="gray" truncate>
					{activeDir}
				</Text>
			</Flex>
			<Flex gap="2" wrap="wrap">
				<Badge
					variant="soft"
					style={{
						backgroundColor: hasAudio ? "var(--accent-4)" : "var(--gray-3)",
						color: hasAudio ? "var(--accent-11)" : "var(--gray-11)",
					}}
				>
					<MusicNote1Regular />{" "}
					{hasAudio
						? manifest?.audioFile || "Audio loaded"
						: t("projectBrowser.noAudio", "No audio")}
				</Badge>
				<Badge variant="soft" color="gray">
					<DocumentRegular />{" "}
					{hasLyric
						? `${lyricLines.lyricLines.length} lines`
						: t("projectBrowser.noLyric", "No lyrics")}
				</Badge>
				{manifest?.lyricFile && (
					<Badge
						variant="soft"
						style={{
							backgroundColor: "var(--accent-4)",
							color: "var(--accent-11)",
						}}
					>
						<DocumentRegular /> {manifest.lyricFile}
					</Badge>
				)}
			</Flex>
			{linked && (
				<Flex direction="column" gap="1">
					<Text size="1" color="gray" truncate>
						<DocumentRegular fontSize={10} /> {linked.lyricPath}
					</Text>
					<Text size="1" color="gray" truncate>
						<MusicNote1Regular fontSize={10} /> {linked.audioPath}
					</Text>
				</Flex>
			)}
			<Flex justify="end" gap="2">
				<Button variant="soft" onClick={handleBrowse}>
					<FolderOpenRegular /> {t("projectsDialog.browse", "Browse…")}
				</Button>
				<Button
					onClick={handleSave}
					style={{
						backgroundColor: "var(--accent-9)",
						color: "var(--accent-9-contrast)",
					}}
				>
					<SaveRegular /> {t("projectsDialog.save", "Save")}
				</Button>
			</Flex>
		</Flex>
	);
};

const RecentTab = ({
	query,
	onClose,
}: {
	query: string;
	onClose: () => void;
}) => {
	const { t } = useTranslation();
	const [projects, setProjects] = useState<RecentProjectEntry[]>([]);
	const [fileStatus, setFileStatus] = useState<
		Record<string, RecentProjectFileStatus | null>
	>({});
	const [loading, setLoading] = useState(false);
	const { openProjectFromDir } = useFolderProject();

	const loadProjects = useCallback(async () => {
		setLoading(true);
		try {
			const list = await getRecentProjects();
			setProjects(list);
			const statuses = await Promise.all(
				list.map((p) => getRecentProjectFileStatus(p)),
			);
			setFileStatus(
				Object.fromEntries(list.map((p, i) => [p.dir, statuses[i]])),
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadProjects();
	}, [loadProjects]);

	useEffect(() => {
		const handleFocus = () => loadProjects();
		window.addEventListener("focus", handleFocus);
		return () => window.removeEventListener("focus", handleFocus);
	}, [loadProjects]);

	const handleOpen = useCallback(
		(dir: string) => {
			onClose();
			openProjectFromDir(dir);
		},
		[openProjectFromDir, onClose],
	);

	const handleRemove = useCallback(
		async (e: React.MouseEvent, dir: string) => {
			e.stopPropagation();
			await removeRecentProject(dir);
			await loadProjects();
		},
		[loadProjects],
	);

	const visible = projects.filter((p) =>
		matchesQuery(
			query,
			p.name,
			p.dir,
			p.linked?.lyricPath,
			p.linked?.audioPath,
		),
	);

	return (
		<ScrollArea type="auto" scrollbars="vertical" style={{ flexGrow: 1 }}>
			<Flex direction="column" gap="2" pr="3">
				{visible.length === 0 ? (
					<Text size="2" color="gray" align="center" my="4" as="div">
						{loading
							? t("projectsDialog.loading", "Loading…")
							: projects.length > 0
								? t("projectsDialog.noMatches", "No projects match your search")
								: t("projectsDialog.noRecent", "No recent projects")}
					</Text>
				) : (
					visible.map((p) => {
						const status = fileStatus[p.dir];
						const lyricMissing = status ? !status.lyricFileExists : false;
						const audioMissing = status ? !status.audioFileExists : false;
						return (
							<Card
								key={p.dir}
								variant="surface"
								onClick={() => handleOpen(p.dir)}
								style={{ cursor: "pointer" }}
							>
								<Flex justify="between" align="center" gap="3">
									<Flex
										direction="column"
										gap="1"
										style={{ flexGrow: 1, overflow: "hidden" }}
									>
										<Text weight="bold" truncate>
											{p.name}
										</Text>
										<Text size="1" color="gray" truncate>
											{p.linked?.lyricPath ?? p.dir}
										</Text>
										<Flex gap="2" mt="1" wrap="wrap">
											{p.linked && <LinkedBadge />}
											<FileBadge
												kind="lyric"
												name={p.lyricFile}
												missing={lyricMissing}
											/>
											<FileBadge
												kind="audio"
												name={p.audioFile}
												missing={audioMissing}
											/>
											<Flex gap="1" align="center">
												<ClockRegular fontSize={10} />
												<Text size="1" color="gray">
													<RelativeTime
														timestamp={p.updatedAt ?? p.lastOpened}
													/>
												</Text>
											</Flex>
										</Flex>
									</Flex>
									<IconButton
										size="1"
										variant="ghost"
										color="gray"
										onClick={(e) => handleRemove(e, p.dir)}
									>
										<DeleteRegular />
									</IconButton>
								</Flex>
							</Card>
						);
					})
				)}
			</Flex>
		</ScrollArea>
	);
};

const LinkedTab = ({
	query,
	onClose,
}: {
	query: string;
	onClose: () => void;
}) => {
	const { t } = useTranslation();
	const activeDir = useAtomValue(activeProjectDirAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const [projects, setProjects] = useState<LinkedProjectEntry[]>([]);
	const [fileStatus, setFileStatus] = useState<
		Record<string, RecentProjectFileStatus | null>
	>({});
	const [backups, setBackups] = useState<Record<string, LinkedBackupInfo>>({});
	const [loading, setLoading] = useState(false);
	const { openProjectFromDir } = useFolderProject();

	const loadProjects = useCallback(async () => {
		setLoading(true);
		try {
			const list = await listLinkedProjects();
			setProjects(list);
			const statuses = await Promise.all(
				list.map(({ dir, manifest }) =>
					getRecentProjectFileStatus({
						dir,
						name: manifest.name,
						audioFile: manifest.audioFile,
						lyricFile: manifest.lyricFile,
						lastOpened: 0,
						linked: manifest.linked,
					}),
				),
			);
			setFileStatus(
				Object.fromEntries(list.map((p, i) => [p.dir, statuses[i]])),
			);
			const backupInfos = await Promise.all(
				list.map(({ dir }) => getLinkedBackupInfo(dir)),
			);
			setBackups(
				Object.fromEntries(list.map((p, i) => [p.dir, backupInfos[i]])),
			);
		} finally {
			setLoading(false);
		}
	}, []);

	useEffect(() => {
		loadProjects();
	}, [loadProjects]);

	useEffect(() => {
		const handleFocus = () => loadProjects();
		window.addEventListener("focus", handleFocus);
		return () => window.removeEventListener("focus", handleFocus);
	}, [loadProjects]);

	const handleOpen = useCallback(
		(dir: string) => {
			onClose();
			openProjectFromDir(dir);
		},
		[openProjectFromDir, onClose],
	);

	const handleOpenBackupDir = useCallback(
		(e: React.MouseEvent, dir: string) => {
			e.stopPropagation();
			invoke("open_linked_project_dir", { dir }).catch((err) => {
				logError("Failed to open the linked project folder", err);
				toast.error(t("error.openFolderFailed", "Could not open the folder"));
			});
		},
		[t],
	);

	const handleRemove = useCallback(
		(e: React.MouseEvent, entry: LinkedProjectEntry) => {
			e.stopPropagation();
			setConfirmDialog({
				open: true,
				title: t("projectsDialog.removeLinkTitle", "Remove linked project?"),
				description: t(
					"projectsDialog.removeLinkDescription",
					"The project entry is removed from the app. Your TTML and audio files are not deleted.",
				),
				onConfirm: async () => {
					try {
						await removeLinkedProject(entry.dir);
					} catch (err) {
						logError("Failed to remove linked project", err);
					}
					await loadProjects();
				},
			});
		},
		[loadProjects, setConfirmDialog, t],
	);

	const visible = projects.filter(({ manifest }) =>
		matchesQuery(
			query,
			manifest.name,
			manifest.linked.lyricPath,
			manifest.linked.audioPath,
		),
	);

	return (
		<Flex direction="column" gap="2" style={{ flexGrow: 1, minHeight: 0 }}>
			<Flex justify="between" align="center" gap="3">
				<Text size="1" color="gray" as="div">
					{t(
						"projectsDialog.linkedHint",
						"Projects that keep their TTML and audio in their original folders. Create one by choosing Keep files in place when the app offers to create a project.",
					)}
				</Text>
				{isTauri() && (
					<Button
						size="1"
						variant="soft"
						style={{ flexShrink: 0 }}
						onClick={() =>
							invoke("open_linked_projects_folder").catch((err) =>
								logError("Failed to open the linked projects folder", err),
							)
						}
					>
						<FolderOpenRegular />
						{t("projectsDialog.openLinkedFolder", "Open projects folder")}
					</Button>
				)}
			</Flex>
			<Box flexGrow="1" style={{ minHeight: 0, overflow: "hidden" }}>
				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ maxHeight: "46vh" }}
				>
					<Flex direction="column" gap="2" pr="3">
						{visible.length === 0 ? (
							<Text size="2" color="gray" align="center" my="4" as="div">
								{loading
									? t("projectsDialog.loading", "Loading…")
									: projects.length > 0
										? t(
												"projectsDialog.noMatches",
												"No projects match your search",
											)
										: t("projectsDialog.noLinked", "No linked projects yet")}
							</Text>
						) : (
							visible.map((entry) => {
								const { dir, manifest } = entry;
								const status = fileStatus[dir];
								const backup = backups[dir];
								return (
									<Card
										key={dir}
										variant="surface"
										onClick={() => handleOpen(dir)}
										style={{ cursor: "pointer" }}
									>
										<Flex justify="between" align="center" gap="3">
											<Flex
												direction="column"
												gap="1"
												style={{ flexGrow: 1, overflow: "hidden" }}
											>
												<Text weight="bold" truncate>
													{manifest.name}
												</Text>
												<Text size="1" color="gray" truncate>
													{manifest.linked.lyricPath}
												</Text>
												<Text size="1" color="gray" truncate>
													{manifest.linked.audioPath}
												</Text>
												<Flex gap="2" mt="1" wrap="wrap">
													<FileBadge
														kind="lyric"
														name={manifest.lyricFile}
														missing={status ? !status.lyricFileExists : false}
													/>
													<FileBadge
														kind="audio"
														name={manifest.audioFile}
														missing={status ? !status.audioFileExists : false}
													/>
													{backup?.exists && backup.mtimeMs != null && (
														<Button
															size="1"
															variant="soft"
															color="iris"
															onClick={(e) => handleOpenBackupDir(e, dir)}
															title={t(
																"projectsDialog.showBackup",
																"Show backup location",
															)}
														>
															<FolderOpenRegular fontSize={10} />
															<Text size="1">
																{new Date(backup.mtimeMs).toLocaleString()}
															</Text>
														</Button>
													)}
													<Flex gap="1" align="center">
														<ClockRegular fontSize={10} />
														<Text size="1" color="gray">
															<RelativeTime
																timestamp={manifest.updatedAt ?? 0}
															/>
														</Text>
													</Flex>
												</Flex>
											</Flex>
											<IconButton
												size="1"
												variant="ghost"
												color="gray"
												disabled={dir === activeDir}
												aria-label={t(
													"projectsDialog.removeLinkTitle",
													"Remove linked project?",
												)}
												onClick={(e) => handleRemove(e, entry)}
											>
												<DeleteRegular />
											</IconButton>
										</Flex>
									</Card>
								);
							})
						)}
					</Flex>
				</ScrollArea>
			</Box>
		</Flex>
	);
};

const WorkspaceTab = ({
	query,
	onClose,
}: {
	query: string;
	onClose: () => void;
}) => {
	const { t } = useTranslation();
	const [projects] = useAtom(workspaceProjectsAtom);
	const [dir] = useAtom(workspaceDirAtom);
	const [scanning] = useAtom(workspaceScanningAtom);
	const hubEnabled = useAtomValue(projectsHubEnabledAtom);
	const { openWorkspace, rescanWorkspace, openProjectFromDir } =
		useFolderProject();

	useEffect(() => {
		if (dir) rescanWorkspace();
	}, [dir, rescanWorkspace]);

	useEffect(() => {
		if (!dir) return;
		const handleFocus = () => rescanWorkspace();
		window.addEventListener("focus", handleFocus);
		return () => window.removeEventListener("focus", handleFocus);
	}, [dir, rescanWorkspace]);

	const handleOpen = useCallback(
		(dir: string) => {
			onClose();
			openProjectFromDir(dir);
		},
		[openProjectFromDir, onClose],
	);

	const handleScan = useCallback(() => {
		void openWorkspace();
	}, [openWorkspace]);

	const visible = projects.filter((project) =>
		matchesQuery(query, project.name, project.dir),
	);

	return (
		<Flex direction="column" gap="2" style={{ flexGrow: 1, minHeight: 0 }}>
			{dir && (
				<Text size="1" color="gray" as="div">
					<Flex align="center" gap="1">
						<FolderOpenRegular fontSize={12} />
						{dir}
					</Flex>
				</Text>
			)}
			<Box flexGrow="1" style={{ minHeight: 0, overflow: "hidden" }}>
				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ maxHeight: "46vh" }}
				>
					<Flex direction="column" gap="2" pr="3">
						{visible.length === 0 ? (
							<Text size="2" color="gray" align="center" my="4" as="div">
								{scanning
									? t("workspace.scanning", "Scanning…")
									: projects.length > 0
										? t(
												"projectsDialog.noMatches",
												"No projects match your search",
											)
										: t(
												"workspace.empty",
												"No projects found. Select a workspace folder to scan.",
											)}
							</Text>
						) : (
							visible.map((project) => (
								<Card
									key={project.dir}
									variant="surface"
									onClick={() => handleOpen(project.dir)}
									style={{ cursor: "pointer" }}
								>
									<Flex
										direction="column"
										gap="1"
										style={{ overflow: "hidden" }}
									>
										<Flex align="center" gap="2">
											<Text weight="bold" size="2" truncate>
												{project.name}
											</Text>
											{!project.hasManifest && (
												<Badge variant="soft">
													{t("workspace.importable", "Importable")}
												</Badge>
											)}
										</Flex>
										<Text size="1" color="gray" truncate>
											{project.dir}
										</Text>
										<Flex gap="2" align="center" mt="1" wrap="wrap">
											<Badge variant="soft">
												<Flex align="center" gap="1">
													<DocumentRegular fontSize={12} />
													{project.lyricFile ||
														t("projectBrowser.noLyric", "No lyrics")}
												</Flex>
											</Badge>
											<Badge variant="soft">
												<Flex align="center" gap="1">
													<MusicNote1Regular fontSize={12} />
													{project.audioFile ||
														t("projectBrowser.noAudio", "No audio")}
												</Flex>
											</Badge>
											<Flex gap="1" align="center">
												<ClockRegular fontSize={12} />
												<Text size="1" color="gray">
													<RelativeTime timestamp={project.updatedAt} />
												</Text>
											</Flex>
										</Flex>
									</Flex>
								</Card>
							))
						)}
					</Flex>
				</ScrollArea>
			</Box>
			{hubEnabled && <LinkableFilesPanel />}
			<Flex justify="between" align="center">
				<Text size="1" color="gray">
					{projects.length > 0
						? t(
								"workspace.foundCount",
								"{count, plural, one {# project found} other {# projects found}}",
								{
									count: projects.length,
								},
							)
						: ""}
				</Text>
				<Button variant="soft" onClick={handleScan}>
					<FolderOpenRegular />
					{hubEnabled
						? t("projectsHub.scan.select", "Scan a folder for TTMLs...")
						: t("workspace.selectFolder", "Select workspace folder…")}
				</Button>
			</Flex>
		</Flex>
	);
};
