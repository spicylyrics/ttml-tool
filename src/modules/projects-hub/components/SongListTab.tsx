import {
	Checkmark16Regular,
	Delete16Regular,
	Edit16Regular,
	Play16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	IconButton,
	ScrollArea,
	SegmentedControl,
	Text,
} from "@radix-ui/themes";
import { useAtom, useStore } from "jotai";
import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	addChecklistEntry,
	deleteChecklistEntry,
	normalizeChecklistEntries,
	setChecklistEntryCompleted,
	type TTMLChecklistEntry,
	updateChecklistEntry,
} from "$/modules/ttml-checklist/logic";
import { ttmlChecklistAtom } from "$/modules/ttml-checklist/states";
import { EntryForm } from "$/modules/ttml-checklist/TTMLChecklistDialog";
import { addGeniusSong } from "../logic/song-list";
import { startSongListProject } from "../song-list-actions";
import { GeniusSongSearch } from "./GeniusSongSearch";

type AddMode = "manual" | "genius";

const SongRow = ({
	entry,
	onStart,
	onComplete,
	onDelete,
	onEdit,
}: {
	entry: TTMLChecklistEntry;
	onStart: () => void;
	onComplete: (completed: boolean) => void;
	onDelete: () => void;
	onEdit: (input: { song: string; artist: string; notes: string }) => void;
}) => {
	const { t } = useTranslation();
	const [editing, setEditing] = useState(false);

	if (editing)
		return (
			<Card variant="surface">
				<EntryForm
					initial={entry}
					onCancel={() => setEditing(false)}
					onSubmit={(input) => {
						onEdit(input);
						setEditing(false);
					}}
				/>
			</Card>
		);

	return (
		<Card variant="surface">
			<Flex gap="3" align="center">
				<Flex direction="column" gap="1" flexGrow="1" minWidth="0">
					<Flex gap="2" align="center" minWidth="0">
						<Text weight="bold" truncate>
							{entry.song}
						</Text>
						{entry.startedAt && !entry.completed && (
							<Badge variant="soft" color="gray">
								{t("projectsHub.songs.inProgress", "Started")}
							</Badge>
						)}
					</Flex>
					{entry.artist && (
						<Text size="1" color="gray" truncate>
							{entry.artist}
						</Text>
					)}
					{entry.notes && (
						<details>
							<summary>
								<Text size="1" color="gray">
									{t("projectsHub.songs.showNotes", "Show notes")}
								</Text>
							</summary>
							<Text size="2" as="div" mt="1" style={{ whiteSpace: "pre-wrap" }}>
								{entry.notes}
							</Text>
						</details>
					)}
				</Flex>
				<Flex gap="1" align="center" flexShrink="0">
					{!entry.completed && (
						<Button size="1" onClick={onStart}>
							<Play16Regular />
							{t("projectsHub.songs.start", "Start project")}
						</Button>
					)}
					<Button
						size="1"
						variant="soft"
						color="gray"
						onClick={() => onComplete(!entry.completed)}
					>
						{entry.completed ? (
							t("projectsHub.songs.reopen", "Reopen")
						) : (
							<>
								<Checkmark16Regular />
								{t("projectsHub.songs.markDone", "Done")}
							</>
						)}
					</Button>
					<IconButton
						size="1"
						variant="ghost"
						color="gray"
						onClick={() => setEditing(true)}
						aria-label={t("projectsHub.songs.edit", "Edit song")}
						title={t("projectsHub.songs.edit", "Edit song")}
					>
						<Edit16Regular />
					</IconButton>
					<IconButton
						size="1"
						variant="ghost"
						color="red"
						onClick={onDelete}
						aria-label={t("projectsHub.songs.delete", "Remove song")}
						title={t("projectsHub.songs.delete", "Remove song")}
					>
						<Delete16Regular />
					</IconButton>
				</Flex>
			</Flex>
		</Card>
	);
};

/**
 * The "To sync" list in the Projects window. It reads and writes the same
 * storage as the old TTML checklist, so existing entries show up as they are.
 */
export const SongListTab = ({ onClose }: { onClose: () => void }) => {
	const { t } = useTranslation();
	const actionT = useCallback(
		(key: string, fallback?: string, options?: Record<string, unknown>) =>
			t(key, fallback ?? key, options),
		[t],
	);
	const store = useStore();
	const [stored, setStored] = useAtom(ttmlChecklistAtom);
	const [mode, setMode] = useState<AddMode>("manual");
	const [formKey, setFormKey] = useState(0);
	const [showCompleted, setShowCompleted] = useState(false);
	const entries = useMemo(() => normalizeChecklistEntries(stored), [stored]);
	const open = entries.filter((entry) => !entry.completed);
	const done = entries.filter((entry) => entry.completed);

	const row = (entry: TTMLChecklistEntry) => (
		<SongRow
			key={entry.id}
			entry={entry}
			onStart={() => startSongListProject(store, entry, actionT, onClose)}
			onComplete={(completed) =>
				setStored(setChecklistEntryCompleted(entries, entry.id, completed))
			}
			onDelete={() => setStored(deleteChecklistEntry(entries, entry.id))}
			onEdit={(input) =>
				setStored(updateChecklistEntry(entries, entry.id, input))
			}
		/>
	);

	return (
		<Flex direction="column" gap="3" style={{ flexGrow: 1, minHeight: 0 }}>
			<Text size="1" color="gray" as="div">
				{t(
					"projectsHub.songs.description",
					"Songs you want to sync next. Start a project from one, and it's marked done when you export the TTML.",
				)}
			</Text>
			<SegmentedControl.Root
				value={mode}
				onValueChange={(value) => setMode(value as AddMode)}
				size="1"
				style={{ alignSelf: "start" }}
			>
				<SegmentedControl.Item value="manual">
					{t("projectsHub.songs.addManually", "Type it in")}
				</SegmentedControl.Item>
				<SegmentedControl.Item value="genius">
					{t("projectsHub.songs.searchGenius", "Search Genius")}
				</SegmentedControl.Item>
			</SegmentedControl.Root>
			{mode === "manual" ? (
				<EntryForm
					key={formKey}
					submitLabel={t("projectsHub.songs.add", "Add to the list")}
					onSubmit={(input) => {
						setStored(addChecklistEntry(entries, input));
						setFormKey((key) => key + 1);
					}}
				/>
			) : (
				<GeniusSongSearch
					onPick={(track) => {
						const result = addGeniusSong(entries, track);
						if (result.added) {
							setStored(result.entries);
							toast.success(
								t("projectsHub.songs.added", "Added {song} to the list.", {
									song: track.song,
								}),
							);
						} else {
							toast.info(
								t(
									"projectsHub.songs.alreadyListed",
									"{song} is already on the list.",
									{ song: track.song },
								),
							);
						}
					}}
				/>
			)}
			<Box flexGrow="1" style={{ minHeight: 0, overflow: "hidden" }}>
				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ maxHeight: "36vh" }}
				>
					<Flex direction="column" gap="2" pr="3">
						{open.length === 0 ? (
							<Text size="2" color="gray" align="center" my="4" as="div">
								{t(
									"projectsHub.songs.empty",
									"Nothing to sync yet. Add the next song before you forget it.",
								)}
							</Text>
						) : (
							open.map(row)
						)}
						{done.length > 0 && (
							<Box mt="1">
								<Button
									variant="ghost"
									color="gray"
									size="1"
									onClick={() => setShowCompleted((value) => !value)}
								>
									{showCompleted
										? t("projectsHub.songs.hideCompleted", "Hide done")
										: t("projectsHub.songs.showCompleted", "Done ({count})", {
												count: done.length,
											})}
								</Button>
								{showCompleted && (
									<Flex direction="column" gap="2" mt="2">
										{done.map(row)}
									</Flex>
								)}
							</Box>
						)}
					</Flex>
				</ScrollArea>
			</Box>
		</Flex>
	);
};
