import { Delete16Regular, Edit16Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Dialog,
	Flex,
	IconButton,
	ScrollArea,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { ttmlChecklistDialogAtom } from "$/states/dialogs.ts";
import {
	addChecklistEntry,
	deleteChecklistEntry,
	normalizeChecklistEntries,
	setChecklistEntryCompleted,
	type TTMLChecklistEntry,
	updateChecklistEntry,
} from "./logic";
import { ttmlChecklistAtom } from "./states";

type EntryFormProps = {
	initial?: TTMLChecklistEntry;
	onCancel?: () => void;
	onSubmit: (input: { song: string; artist: string; notes: string }) => void;
	/** Overrides the add button's text. */
	submitLabel?: string;
};

export const EntryForm = ({
	initial,
	onCancel,
	onSubmit,
	submitLabel,
}: EntryFormProps) => {
	const { t } = useTranslation();
	const [song, setSong] = useState(initial?.song ?? "");
	const [artist, setArtist] = useState(initial?.artist ?? "");
	const [notes, setNotes] = useState(initial?.notes ?? "");
	const valid = song.trim().length > 0;

	return (
		<Flex direction="column" gap="2" asChild>
			<form
				onSubmit={(event) => {
					event.preventDefault();
					if (valid) onSubmit({ song, artist, notes });
				}}
			>
				<TextField.Root
					placeholder={t("ttmlChecklist.songPlaceholder", "Song title *")}
					value={song}
					onChange={(event) => setSong(event.currentTarget.value)}
				/>
				<TextField.Root
					placeholder={t(
						"ttmlChecklist.artistPlaceholder",
						"Artist (optional)",
					)}
					value={artist}
					onChange={(event) => setArtist(event.currentTarget.value)}
				/>
				<TextArea
					placeholder={t(
						"ttmlChecklist.notesPlaceholder",
						"Notes, version, source, or timing idea (optional)",
					)}
					value={notes}
					onChange={(event) => setNotes(event.currentTarget.value)}
					rows={3}
				/>
				<Flex justify="end" gap="2">
					{onCancel && (
						<Button
							type="button"
							variant="soft"
							color="gray"
							onClick={onCancel}
						>
							{t("ttmlChecklist.cancel", "Cancel")}
						</Button>
					)}
					<Button type="submit" disabled={!valid}>
						{(!initial && submitLabel) ||
							t(
								initial ? "ttmlChecklist.save" : "ttmlChecklist.add",
								initial ? "Save" : "Add to checklist",
							)}
					</Button>
				</Flex>
			</form>
		</Flex>
	);
};

type ChecklistEntryCardProps = {
	entry: TTMLChecklistEntry;
	onComplete: (completed: boolean) => void;
	onDelete: () => void;
	onEdit: (input: { song: string; artist: string; notes: string }) => void;
};

const ChecklistEntryCard = ({
	entry,
	onComplete,
	onDelete,
	onEdit,
}: ChecklistEntryCardProps) => {
	const { t } = useTranslation();
	const [editing, setEditing] = useState(false);

	return (
		<Box
			style={{
				width: "100%",
				padding: "12px",
				border: "1px solid var(--gray-a5)",
				borderRadius: "var(--radius-3)",
			}}
		>
			{editing ? (
				<EntryForm
					initial={entry}
					onCancel={() => setEditing(false)}
					onSubmit={(input) => {
						onEdit(input);
						setEditing(false);
					}}
				/>
			) : (
				<Flex gap="3" align="start">
					<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
						<Text
							weight="bold"
							style={{
								textDecoration: entry.completed ? "line-through" : undefined,
							}}
						>
							{entry.song}
						</Text>
						{entry.artist && (
							<Text size="2" color="gray">
								{entry.artist}
							</Text>
						)}
						{entry.notes && (
							<details>
								<summary>{t("ttmlChecklist.showNotes", "Show notes")}</summary>
								<Text
									size="2"
									as="div"
									mt="1"
									style={{ whiteSpace: "pre-wrap" }}
								>
									{entry.notes}
								</Text>
							</details>
						)}
					</Flex>
					<Flex gap="1">
						<Button
							size="1"
							variant="soft"
							color={entry.completed ? "gray" : "green"}
							onClick={() => onComplete(!entry.completed)}
							style={{ width: "64px", height: "32px" }}
						>
							{entry.completed
								? t("ttmlChecklist.reopen", "Reopen")
								: t("ttmlChecklist.markDone", "Done")}
						</Button>
						<IconButton
							variant="soft"
							color="gray"
							onClick={() => setEditing(true)}
							aria-label={t("ttmlChecklist.edit", "Edit checklist item")}
						>
							<Edit16Regular />
						</IconButton>
						<IconButton
							variant="soft"
							color="red"
							onClick={onDelete}
							aria-label={t("ttmlChecklist.delete", "Delete checklist item")}
						>
							<Delete16Regular />
						</IconButton>
					</Flex>
				</Flex>
			)}
		</Box>
	);
};

export const TTMLChecklistDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(ttmlChecklistDialogAtom);
	const [storedEntries, setStoredEntries] = useAtom(ttmlChecklistAtom);
	const [showCompleted, setShowCompleted] = useState(false);
	const entries = useMemo(
		() => normalizeChecklistEntries(storedEntries),
		[storedEntries],
	);
	const activeEntries = entries.filter((entry) => !entry.completed);
	const completedEntries = entries.filter((entry) => entry.completed);

	const save = (nextEntries: TTMLChecklistEntry[]) => {
		setStoredEntries(nextEntries);
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content style={{ maxWidth: 620 }}>
				<Dialog.Title>
					{t("ttmlChecklist.title", "TTML checklist")}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="4">
					{t(
						"ttmlChecklist.description",
						"Keep track of songs and ideas you want to sync later.",
					)}
				</Dialog.Description>

				<EntryForm
					onSubmit={(input) => save(addChecklistEntry(entries, input))}
				/>

				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ maxHeight: "45vh", marginTop: 20 }}
				>
					<Flex direction="column" gap="2">
						{activeEntries.length === 0 ? (
							<Box py="6" style={{ textAlign: "center" }}>
								<Text color="gray">
									{t(
										"ttmlChecklist.empty",
										"No future TTMLs yet. Add the next song before the idea disappears.",
									)}
								</Text>
							</Box>
						) : (
							activeEntries.map((entry) => (
								<ChecklistEntryCard
									key={entry.id}
									entry={entry}
									onComplete={(completed) =>
										save(
											setChecklistEntryCompleted(entries, entry.id, completed),
										)
									}
									onDelete={() => save(deleteChecklistEntry(entries, entry.id))}
									onEdit={(input) =>
										save(updateChecklistEntry(entries, entry.id, input))
									}
								/>
							))
						)}

						{completedEntries.length > 0 && (
							<Box mt="2">
								<Button
									variant="ghost"
									color="gray"
									onClick={() => setShowCompleted((current) => !current)}
								>
									{showCompleted
										? t("ttmlChecklist.hideCompleted", "Hide completed")
										: t("ttmlChecklist.showCompleted", "Completed ({count})", {
												count: completedEntries.length,
											})}
								</Button>
								{showCompleted && (
									<Flex direction="column" gap="2" mt="2">
										{completedEntries.map((entry) => (
											<ChecklistEntryCard
												key={entry.id}
												entry={entry}
												onComplete={(completed) =>
													save(
														setChecklistEntryCompleted(
															entries,
															entry.id,
															completed,
														),
													)
												}
												onDelete={() =>
													save(deleteChecklistEntry(entries, entry.id))
												}
												onEdit={(input) =>
													save(updateChecklistEntry(entries, entry.id, input))
												}
											/>
										))}
									</Flex>
								)}
							</Box>
						)}
					</Flex>
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
};
