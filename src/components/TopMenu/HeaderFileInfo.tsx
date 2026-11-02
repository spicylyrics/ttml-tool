import {
	ArrowUndoRegular,
	FolderOpenRegular,
	HistoryRegular,
	LinkRegular,
	SaveEditRegular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Flex,
	IconButton,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	linkedBackupExists,
	restoreLinkedBackup,
} from "$/modules/project/folder-project/linked-backup";
import {
	activeProjectDirAtom,
	activeProjectManifestAtom,
	linkedBackupAvailableAtom,
} from "$/modules/project/folder-project/state";
import { getSuggestedTtmlFileName } from "$/modules/project/logic/metadata-filename";
import { confirmDialogAtom, historyRestoreDialogAtom } from "$/states/dialogs";
import {
	isDirtyAtom,
	lastSavedTimeAtom,
	lyricMetadataAtom,
	saveFileNameAtom,
} from "$/states/main";
import { useTopMenuActions } from "./useTopMenuActions";

export const HeaderFileInfo = () => {
	const { t } = useTranslation();
	const store = useStore();
	const { onSaveFile } = useTopMenuActions();
	const [filename, setFilename] = useAtom(saveFileNameAtom);
	const lastSavedTime = useAtomValue(lastSavedTimeAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const activeProjectDir = useAtomValue(activeProjectDirAtom);
	const activeProjectManifest = useAtomValue(activeProjectManifestAtom);
	const [backupAvailable, setBackupAvailable] = useAtom(
		linkedBackupAvailableAtom,
	);
	const setHistoryDialogOpen = useSetAtom(historyRestoreDialogAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const metadata = useAtomValue(lyricMetadataAtom);
	const [isEditing, setIsEditing] = useState(false);
	const [draftName, setDraftName] = useState("");
	const [autoSaveExpanded, setAutoSaveExpanded] = useState(false);
	const [autoSaveTimeLabel, setAutoSaveTimeLabel] = useState("");
	const inputRef = useRef<HTMLInputElement>(null);
	const lastSavedTimeRef = useRef<number | null>(null);
	const suffix = ".ttml";
	const suggestedFile = getSuggestedTtmlFileName(metadata);

	const getBaseName = useCallback(
		(value: string) =>
			value.toLowerCase().endsWith(suffix)
				? value.slice(0, -suffix.length)
				: value,
		[],
	);

	const finishEditing = useCallback(
		({ commit }: { commit: boolean }) => {
			if (commit) {
				const trimmed = draftName.trim();
				if (trimmed.length > 0) {
					setFilename(`${trimmed}${suffix}`);
				} else {
					setDraftName(getBaseName(filename));
				}
			}
			setIsEditing(false);
		},
		[draftName, filename, getBaseName, setFilename],
	);

	useEffect(() => {
		if (!isEditing) return;
		setDraftName(getBaseName(filename));
		inputRef.current?.focus();
		inputRef.current?.select();
	}, [filename, getBaseName, isEditing]);

	useEffect(() => {
		if (!lastSavedTime) return;
		if (lastSavedTimeRef.current === lastSavedTime) return;
		lastSavedTimeRef.current = lastSavedTime;
		setAutoSaveTimeLabel(new Date(lastSavedTime).toLocaleTimeString());
		setAutoSaveExpanded(true);
		const timer = window.setTimeout(() => {
			setAutoSaveExpanded(false);
		}, 4000);
		return () => window.clearTimeout(timer);
	}, [lastSavedTime]);

	useEffect(() => {
		if (!activeProjectDir) {
			setBackupAvailable(false);
			return;
		}
		let cancelled = false;
		if (!activeProjectManifest?.linked) {
			setBackupAvailable(false);
			return;
		}
		void linkedBackupExists(activeProjectDir).then((found) => {
			if (!cancelled) setBackupAvailable(found);
		});
		return () => {
			cancelled = true;
		};
	}, [activeProjectDir, activeProjectManifest, setBackupAvailable]);

	const handleRestoreBackup = useCallback(() => {
		if (!activeProjectDir || !activeProjectManifest?.linked) return;
		const dir = activeProjectDir;
		const manifest = {
			...activeProjectManifest,
			linked: activeProjectManifest.linked,
		};
		const plainT = (key: string, fallback?: string) => t(key, fallback ?? key);
		setConfirmDialog({
			open: true,
			title: t("header.backup.confirmTitle", "Restore linked backup?"),
			description: t(
				"header.backup.confirmDescription",
				"The original TTML saved before the first overwrite will replace the current song file and the backup will be removed. Unsaved changes in the editor will be lost.",
			),
			onConfirm: () => {
				void restoreLinkedBackup(store, plainT, dir, manifest).then(
					async () => {
						setBackupAvailable(await linkedBackupExists(dir));
					},
				);
			},
		});
	}, [
		activeProjectDir,
		activeProjectManifest,
		setConfirmDialog,
		setBackupAvailable,
		store,
		t,
	]);

	const handleNameClick = useCallback(() => {
		const isDefaultName = filename.toLowerCase() === "lyric.ttml";
		if (isDefaultName && suggestedFile) {
			setConfirmDialog({
				open: true,
				title: t("confirmDialog.useMetadataName.title", "使用元数据命名？"),
				description: t(
					"confirmDialog.useMetadataName.description",
					'是否使用"{name}"作为文件名？',
					{ name: suggestedFile.baseName },
				),
				onConfirm: () => {
					setFilename(suggestedFile.fileName);
				},
			});
			return;
		}
		setIsEditing(true);
	}, [filename, setConfirmDialog, setFilename, suggestedFile, t]);

	const autoSavedLabel = t("header.status.autoSavedAt", "已自动保存于 {time}", {
		time: autoSaveTimeLabel,
	});

	return (
		<Flex align="center" gap="2" style={{ maxWidth: "100%" }}>
			<Button
				variant="soft"
				onClick={() => setHistoryDialogOpen(true)}
				title={autoSaveExpanded ? autoSavedLabel : undefined}
				style={{
					justifyContent: "start",
					overflow: "hidden",
					whiteSpace: "nowrap",
					maxWidth: autoSaveExpanded ? 220 : 36,
					transition: "max-width 0.3s ease",
				}}
			>
				<Flex align="center" gap="1" minWidth="0">
					<Text size="1" style={{ display: "flex" }}>
						<HistoryRegular />
					</Text>
					{autoSaveExpanded && (
						<Text
							size="1"
							color="gray"
							// Long translations end in an ellipsis instead of being cut off.
							style={{
								minWidth: 0,
								overflow: "hidden",
								textOverflow: "ellipsis",
							}}
						>
							{autoSavedLabel}
						</Text>
					)}
				</Flex>
			</Button>

			<Box>
				{isEditing ? (
					<Flex align="center" gap="1">
						<TextField.Root
							ref={inputRef}
							size="1"
							value={draftName}
							onChange={(e) => setDraftName(e.target.value)}
							placeholder={t("header.project.namePlaceholder", "Project name")}
							style={{ width: "10rem" }}
							onBlur={() => finishEditing({ commit: true })}
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									finishEditing({ commit: true });
								}
								if (event.key === "Escape") {
									finishEditing({ commit: false });
								}
							}}
						/>
						<Text size="2">{suffix}</Text>
					</Flex>
				) : (
					<Button
						variant="ghost"
						style={{
							height: "auto",
							padding: "6px 10px",
							fontWeight: "normal",
							color: "var(--accent-11)",
							maxWidth: "100%",
						}}
						onClick={handleNameClick}
					>
						<Flex align="center" gap="2" style={{ maxWidth: "100%" }}>
							<Flex
								align="center"
								style={{
									maxWidth: "10rem",
									overflow: "hidden",
									whiteSpace: "nowrap",
								}}
							>
								<Text
									weight="bold"
									size="2"
									style={{
										overflow: "hidden",
										textOverflow: "ellipsis",
									}}
								>
									{getBaseName(filename)}
								</Text>
								<Text size="2">{suffix}</Text>
							</Flex>
						</Flex>
					</Button>
				)}
			</Box>

			{activeProjectDir && (
				<IconButton
					size="1"
					variant="soft"
					color={activeProjectManifest?.linked ? "iris" : "gray"}
					title={
						activeProjectManifest?.linked
							? t("header.project.linked", "Linked project")
							: t("header.project.folder", "Folder project")
					}
					style={{ cursor: "default" }}
				>
					{activeProjectManifest?.linked ? (
						<LinkRegular />
					) : (
						<FolderOpenRegular />
					)}
				</IconButton>
			)}
			{activeProjectManifest?.linked && backupAvailable && (
				<IconButton
					size="1"
					variant="soft"
					color="iris"
					onClick={handleRestoreBackup}
					title={t("header.backup.restore", "Restore backup")}
				>
					<ArrowUndoRegular />
				</IconButton>
			)}
			{isDirty && (
				<IconButton
					size="1"
					variant="soft"
					color="amber"
					onClick={onSaveFile}
					title={t("header.status.unsavedChanges", "Unsaved changes")}
					aria-label={t("header.status.unsavedChanges", "Unsaved changes")}
				>
					<SaveEditRegular />
				</IconButton>
			)}
		</Flex>
	);
};
