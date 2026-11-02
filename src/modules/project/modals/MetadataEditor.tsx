import {
	CheckmarkCircle16Regular,
	ChevronRight16Regular,
	Delete16Regular,
	Dismiss16Regular,
	Info16Regular,
	PersonSearch16Regular,
} from "@fluentui/react-icons";
import {
	Button,
	Dialog,
	Flex,
	IconButton,
	Link,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, useId, useState } from "react";
import { useTranslation } from "react-i18next";
import { FieldRow } from "$/components/FieldRow";
import { NameListInput } from "$/components/NameListInput";
import { Panel } from "$/components/Panel";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import { getBetterGeniusCoverArt } from "$/modules/genius/utils/image";
import { getGuideUrl } from "$/modules/onboarding/logic";
import {
	confirmDialogAtom,
	metadataEditorDialogAtom,
	songwriterFinderDialogAtom,
} from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import {
	isBuiltinMetadataKey,
	metadataValues,
	setMetadataValues,
} from "../logic/metadata-fields";
import styles from "./MetadataEditor.module.css";

type SetValues = (
	key: string,
	values: string[],
	options?: { removeWhenEmpty?: boolean },
) => void;

/**
 * A one-value field. A file can still hold several values for it; then it
 * shows them all as a list instead of dropping the extras.
 */
const SingleValueField: FC<{
	values: string[];
	onChange: (values: string[]) => void;
	controlId: string;
	descriptionId?: string;
	placeholder?: string;
}> = ({ values, onChange, controlId, descriptionId, placeholder }) =>
	values.length > 1 ? (
		<NameListInput
			id={controlId}
			aria-describedby={descriptionId}
			values={values}
			onChange={onChange}
		/>
	) : (
		<TextField.Root
			id={controlId}
			aria-describedby={descriptionId}
			value={values[0] ?? ""}
			placeholder={placeholder}
			onChange={(event) => onChange([event.currentTarget.value])}
			autoComplete="off"
			spellCheck={false}
		/>
	);

const SongwritersPanel: FC<{ values: string[]; setValues: SetValues }> = ({
	values,
	setValues,
}) => {
	const { t } = useTranslation();
	const setFinderOpen = useSetAtom(songwriterFinderDialogAtom);
	const baseId = useId();
	const ready = values.some((value) => value.trim());

	return (
		<Panel tone="sunken" size="2" className={styles.songwriters}>
			<div className={styles.songwritersHeader}>
				<Text
					as="label"
					htmlFor={`${baseId}input`}
					size="2"
					weight="medium"
					className={styles.songwritersLabel}
				>
					{t("metadataDialog.songwriters", "Songwriters")}
				</Text>
				<Text
					size="1"
					id={`${baseId}status`}
					className={ready ? styles.statusReady : styles.statusNeeded}
				>
					{ready ? (
						<CheckmarkCircle16Regular aria-hidden />
					) : (
						<Info16Regular aria-hidden />
					)}
					{ready
						? t("metadataDialog.songwritersReady", "Ready for Spicy Lyrics")
						: t("metadataDialog.songwritersNeeded", "Needed for Spicy Lyrics")}
				</Text>
			</div>
			<NameListInput
				id={`${baseId}input`}
				aria-describedby={`${baseId}status`}
				values={values}
				onChange={(next) => setValues("songwriter", next)}
				placeholder={t("metadataDialog.addName", "Add a name...")}
			/>
			<Flex align="center" gap="3" mt="3" wrap="wrap">
				<Button variant="soft" onClick={() => setFinderOpen(true)}>
					<PersonSearch16Regular />
					{t("songwriterFinder.open", "Find songwriters")}
				</Button>
				<Link
					size="1"
					href={getGuideUrl("songwriters")}
					target="_blank"
					rel="noopener noreferrer"
				>
					{t("helpText.openSongwritersGuide", "Open the songwriters guide")}
				</Link>
			</Flex>
		</Panel>
	);
};

const CoverField: FC<{ values: string[]; setValues: SetValues }> = ({
	values,
	setValues,
}) => {
	const { t } = useTranslation();
	const [brokenUrl, setBrokenUrl] = useState<string>();
	const url = values.length === 1 ? values[0].trim() : "";
	const label = t("metadataDialog.builtinOptions.coverArt", "Cover image URL");
	return (
		<FieldRow label={label} stacked>
			{({ controlId }) => (
				<Flex gap="2" align="center" className={styles.coverRow}>
					<SingleValueField
						controlId={controlId}
						values={values}
						onChange={(next) => setValues("cover_art", next)}
						placeholder="https://..."
					/>
					{url && url !== brokenUrl && (
						<img
							className={styles.coverThumb}
							src={getBetterGeniusCoverArt(url, 100)}
							alt=""
							referrerPolicy="no-referrer"
							onError={() => setBrokenUrl(url)}
						/>
					)}
				</Flex>
			)}
		</FieldRow>
	);
};

const OtherFields: FC<{
	entries: { key: string; value: string[] }[];
	setValues: SetValues;
	removeField: (key: string) => void;
}> = ({ entries, setValues, removeField }) => {
	const { t } = useTranslation();
	const [newKey, setNewKey] = useState("");
	const trimmedKey = newKey.trim();
	const keyTaken =
		isBuiltinMetadataKey(trimmedKey) ||
		entries.some((entry) => entry.key === trimmedKey);

	const addField = () => {
		if (!trimmedKey || keyTaken) return;
		setValues(trimmedKey, [], { removeWhenEmpty: false });
		setNewKey("");
	};

	return (
		<details className={styles.other}>
			<summary className={styles.otherSummary}>
				<ChevronRight16Regular aria-hidden className={styles.chevron} />
				<Text size="1">
					{t(
						"metadataDialog.otherFields",
						"{count, plural, =0 {Custom fields (optional)} other {Custom fields (#, optional)}}",
						{ count: entries.length },
					)}
				</Text>
			</summary>
			<Flex direction="column" gap="4" pt="3">
				<Text size="1" color="gray">
					{t(
						"metadataDialog.otherFieldsHint",
						"Extra values saved in the file. Spicy Lyrics doesn't use them, so most songs need none.",
					)}
				</Text>
				{entries.map((entry) => (
					<FieldRow key={entry.key} label={entry.key} stacked>
						{({ controlId }) => (
							<Flex gap="2" align="start" className={styles.otherRow}>
								<NameListInput
									id={controlId}
									values={entry.value}
									onChange={(next) =>
										setValues(entry.key, next, { removeWhenEmpty: false })
									}
									placeholder={t("metadataDialog.addValue", "Add a value...")}
								/>
								<IconButton
									variant="ghost"
									color="gray"
									mt="1"
									aria-label={t("metadataDialog.removeField", "Remove {key}", {
										key: entry.key,
									})}
									onClick={() => removeField(entry.key)}
								>
									<Delete16Regular />
								</IconButton>
							</Flex>
						)}
					</FieldRow>
				))}
				<Flex gap="2" align="center">
					<TextField.Root
						className={styles.grow}
						value={newKey}
						aria-label={t("metadataDialog.customKey", "Field name")}
						placeholder={t("metadataDialog.customKey", "Field name")}
						onChange={(event) => setNewKey(event.currentTarget.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								addField();
							}
						}}
					/>
					<Button
						variant="soft"
						color="gray"
						disabled={!trimmedKey || keyTaken}
						onClick={addField}
					>
						{t("metadataDialog.addKeyValue", "Add field")}
					</Button>
				</Flex>
			</Flex>
		</details>
	);
};

export const MetadataEditor = () => {
	const [open, setOpen] = useAtom(metadataEditorDialogAtom);
	const lyricLines = useLyricLinesWhileOpen(open);
	const setLyricLines = useSetImmerAtom(lyricLinesAtom);
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const { t } = useTranslation();

	const metadata = lyricLines.metadata;
	const setValues: SetValues = (key, values, options) =>
		setLyricLines((prev) => {
			setMetadataValues(prev.metadata, key, values, options);
		});
	const removeField = (key: string) =>
		setLyricLines((prev) => {
			prev.metadata = prev.metadata.filter((entry) => entry.key !== key);
		});
	const otherEntries = metadata.filter(
		(entry) => !isBuiltinMetadataKey(entry.key),
	);

	const textField = (key: string, label: string, description?: string) => (
		<FieldRow label={label} description={description} stacked>
			{({ controlId, descriptionId }) => (
				<SingleValueField
					controlId={controlId}
					descriptionId={descriptionId}
					values={metadataValues(metadata, key)}
					onChange={(next) => setValues(key, next)}
				/>
			)}
		</FieldRow>
	);

	const confirmClear = () =>
		setConfirmDialog({
			open: true,
			title: t("metadataDialog.clearTitle", "Clear all metadata?"),
			description: t(
				"metadataDialog.clearDescription",
				"This empties every field, including songwriters and other fields.",
			),
			confirmText: t("metadataDialog.clearConfirm", "Clear all"),
			onConfirm: () =>
				setLyricLines((prev) => {
					prev.metadata = [];
				}),
		});

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content className={styles.dialogContent}>
				<div className={styles.dialogHeader}>
					<Dialog.Title size="5" mb="0">
						{t("metadataDialog.title", "Edit metadata")}
					</Dialog.Title>
					<Dialog.Close>
						<IconButton
							variant="ghost"
							color="gray"
							aria-label={t("common.close", "Close")}
						>
							<Dismiss16Regular />
						</IconButton>
					</Dialog.Close>
				</div>
				<Dialog.Description className={styles.visuallyHidden}>
					{t(
						"metadataDialog.description",
						"Song details saved in the TTML file.",
					)}
				</Dialog.Description>

				<div className={styles.dialogBody}>
					<SongwritersPanel
						values={metadataValues(metadata, "songwriter")}
						setValues={setValues}
					/>
					{textField(
						"musicName",
						t("metadataDialog.builtinOptions.musicName", "Song title"),
					)}
					<FieldRow
						label={t("metadataDialog.builtinOptions.artists", "Artists")}
						description={t(
							"metadataDialog.artistsHint",
							"As credited on streaming services. One name per artist.",
						)}
						stacked
					>
						{({ controlId, descriptionId }) => (
							<NameListInput
								id={controlId}
								aria-describedby={descriptionId}
								values={metadataValues(metadata, "artists")}
								onChange={(next) => setValues("artists", next)}
								placeholder={t("metadataDialog.addName", "Add a name...")}
							/>
						)}
					</FieldRow>
					{textField(
						"album",
						t("metadataDialog.builtinOptions.album", "Album"),
					)}
					<CoverField
						values={metadataValues(metadata, "cover_art")}
						setValues={setValues}
					/>
					<OtherFields
						entries={otherEntries}
						setValues={setValues}
						removeField={removeField}
					/>
				</div>

				<div className={styles.dialogFooter}>
					<Button
						variant="ghost"
						color="red"
						disabled={metadata.length === 0}
						onClick={confirmClear}
					>
						{t("metadataDialog.clear", "Clear all...")}
					</Button>
					<Dialog.Close>
						<Button>{t("metadataDialog.done", "Done")}</Button>
					</Dialog.Close>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
};
