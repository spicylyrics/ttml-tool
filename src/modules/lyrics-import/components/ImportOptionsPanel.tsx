import {
	ArrowUndoRegular,
	ChevronRightRegular,
	SparkleRegular,
	TextWordCountRegular,
} from "@fluentui/react-icons";
import {
	Button,
	Checkbox,
	Flex,
	Select,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { type ReactNode, useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionPicker } from "$/components/OptionPicker";
import type { LyricPrepOptions } from "$/utils/lyric-prep";
import type {
	ImportContentMode,
	ImportLineSeparatorMode,
} from "../logic/import-text";
import {
	bgLyricPrefixAtom,
	duetLyricPrefixAtom,
	enableSpecialPrefixAtom,
	fetchImportedSongwritersAtom,
	importModeAtom,
	lineSeparatorAtom,
	lineSeparatorModeAtom,
	processStepsAtom,
	processStepsOpenAtom,
	swapTransAndRomanAtom,
	wordSeparatorAtom,
} from "../states";
import styles from "./ImportOptionsPanel.module.css";

function Group({
	title,
	aside,
	children,
}: {
	title: string;
	aside?: ReactNode;
	children: ReactNode;
}) {
	return (
		<Flex direction="column" gap="2" className={styles.group}>
			<Flex align="baseline" justify="between" gap="2">
				<Text size="2" weight="medium">
					{title}
				</Text>
				{aside}
			</Flex>
			{children}
		</Flex>
	);
}

/** One text tool: the action and what it does to the text, as one target. */
function ToolButton({
	icon,
	label,
	description,
	disabled,
	onClick,
}: {
	icon: ReactNode;
	label: string;
	description: string;
	disabled?: boolean;
	onClick: () => void;
}) {
	return (
		<button
			type="button"
			className={styles.tool}
			disabled={disabled}
			onClick={onClick}
		>
			<span className={styles.toolIcon} aria-hidden>
				{icon}
			</span>
			<span className={styles.toolText}>
				<Text size="2" weight="medium">
					{label}
				</Text>
				<Text size="1" className={styles.hint}>
					{description}
				</Text>
			</span>
		</button>
	);
}

function Hint({ id, children }: { id?: string; children: ReactNode }) {
	return (
		<Text id={id} size="1" className={styles.hint}>
			{children}
		</Text>
	);
}

function Row({ label, children }: { label: string; children: ReactNode }) {
	return (
		<label className={styles.row}>
			<Text size="2" color="gray">
				{label}
			</Text>
			{children}
		</label>
	);
}

export function ImportOptionsPanel({
	headerCount,
	makeSections,
	onMakeSectionsChange,
	hasText,
	canRestore,
	canSplit,
	showSongwriters,
	onProcess,
	onSplit,
	onRestore,
}: {
	headerCount: number;
	makeSections: boolean;
	onMakeSectionsChange: (makeSections: boolean) => void;
	hasText: boolean;
	canRestore: boolean;
	canSplit: boolean;
	showSongwriters: boolean;
	onProcess: () => void;
	onSplit: () => void;
	onRestore: () => void;
}) {
	const { t } = useTranslation();
	const [fetchSongwriters, setFetchSongwriters] = useAtom(
		fetchImportedSongwritersAtom,
	);
	const [formatOpen, setFormatOpen] = useState(false);

	return (
		<Flex direction="column" gap="5">
			<Group
				title={t("importLyrics.prepareTitle", "Clean up")}
				aside={
					canRestore && (
						<Button size="1" variant="ghost" color="gray" onClick={onRestore}>
							<ArrowUndoRegular />
							{t("importLyrics.restoreOriginal", "Restore original text")}
						</Button>
					)
				}
			>
				<Flex direction="column" gap="1">
					<ToolButton
						icon={<SparkleRegular />}
						label={t("textImportDialog.processLyrics", "Process lyrics")}
						description={t(
							"importLyrics.processHint",
							"Splits words, tidies punctuation and spacing, and moves parenthesized vocals to background lines.",
						)}
						disabled={!hasText}
						onClick={onProcess}
					/>
					<ProcessSteps />
					<ToolButton
						icon={<TextWordCountRegular />}
						label={t("importLyrics.splitSyllables", "Split syllables")}
						description={t(
							"importLyrics.splitHint",
							"Marks syllables with the word separator, using your segmentation settings and learned splits. Fix any marks in the text before importing.",
						)}
						disabled={!canSplit}
						onClick={onSplit}
					/>
				</Flex>
			</Group>

			{headerCount > 0 && (
				<Group
					title={t("importLyrics.sectionsTitle", "Section headers")}
					aside={
						<Text size="1" className={styles.hint}>
							{t(
								"importLyrics.sectionsFound",
								"{count, plural, one {# header found} other {# headers found}}",
								{ count: headerCount },
							)}
						</Text>
					}
				>
					<OptionPicker
						variant="segmented"
						fullWidth
						label={t("importLyrics.sectionsTitle", "Section headers")}
						value={makeSections ? "sections" : "remove"}
						onValueChange={(value) =>
							onMakeSectionsChange(value === "sections")
						}
						options={[
							{
								value: "sections",
								label: t("importLyrics.makeSections", "Make sections"),
								description: t(
									"importLyrics.makeSectionsHint",
									"Each header starts a section.",
								),
							},
							{
								value: "remove",
								label: t("importLyrics.removeHeaders", "Remove"),
								description: t(
									"importLyrics.removeHeadersHint",
									"Drops the header rows from the lyrics.",
								),
							},
						]}
					/>
					<Hint>
						{makeSections
							? t(
									"importLyrics.makeSectionsHint",
									"Each header starts a section.",
								)
							: t(
									"importLyrics.removeHeadersHint",
									"Drops the header rows from the lyrics.",
								)}
					</Hint>
				</Group>
			)}

			{showSongwriters && (
				<Text as="label" size="2">
					<Flex gap="2" align="center">
						<Checkbox
							checked={fetchSongwriters}
							onCheckedChange={(checked) =>
								setFetchSongwriters(checked === true)
							}
						/>
						{t(
							"metadataDialog.fetchSongwriters.button",
							"Fetch songwriters from Genius",
						)}
					</Flex>
				</Text>
			)}

			<Flex direction="column" gap="2" className={styles.group}>
				<button
					type="button"
					className={styles.disclosure}
					aria-expanded={formatOpen}
					onClick={() => setFormatOpen(!formatOpen)}
				>
					<ChevronRightRegular className={styles.chevron} />
					<Text size="2" weight="medium">
						{t("importLyrics.textFormat", "Text format")}
					</Text>
				</button>
				{formatOpen && <TextFormatFields />}
			</Flex>
		</Flex>
	);
}

const PROCESS_STEPS: [keyof LyricPrepOptions, string, string][] = [
	[
		"removeInlineBrackets",
		"Remove inline notes",
		"Drops [notes] in the middle of a line. Header rows are kept.",
	],
	[
		"backgroundVocals",
		"Parentheses to background",
		"Moves (vocals) to their own background line.",
	],
	[
		"capitalizeBackground",
		"Capitalize background lines",
		"Starts each background line with a capital letter.",
	],
	[
		"emDashes",
		"Em dashes",
		"Turns double hyphens and stray hyphens into em dashes.",
	],
	[
		"splitHyphens",
		"Split hyphenated words",
		"Splits words like mm-hmm after the hyphen.",
	],
	[
		"splitCjk",
		"Split CJK characters",
		"Splits Chinese, Japanese and Korean text into characters and at script changes.",
	],
	[
		"punctuationSpacing",
		"Tidy punctuation",
		"One space after commas, none before punctuation, and quotes kept on their word.",
	],
	["collapseSpaces", "Collapse spaces", "Turns runs of spaces into one."],
	[
		"splitWords",
		"Split at spaces",
		"Marks each space as a word boundary for the import.",
	],
];

/** The steps Process lyrics runs, each with its own switch. */
function ProcessSteps() {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(processStepsOpenAtom);
	const [steps, setSteps] = useAtom(processStepsAtom);
	return (
		<Flex direction="column" gap="2" className={styles.steps}>
			<button
				type="button"
				className={styles.disclosure}
				aria-expanded={open}
				onClick={() => setOpen(!open)}
			>
				<ChevronRightRegular className={styles.chevron} />
				<Text size="1" weight="medium">
					{t("importLyrics.processSteps.advanced", "Advanced")}
				</Text>
			</button>
			{open &&
				PROCESS_STEPS.map(([key, label, description]) => (
					<label key={key} className={styles.stepRow}>
						<span className={styles.toolText}>
							<Text size="2">
								{t(`importLyrics.processSteps.${key}`, label)}
							</Text>
							<Text size="1" className={styles.hint}>
								{t(`importLyrics.processSteps.${key}Hint`, description)}
							</Text>
						</span>
						<Switch
							size="1"
							checked={steps[key]}
							onCheckedChange={(checked) => setSteps({ [key]: checked })}
						/>
					</label>
				))}
		</Flex>
	);
}

function TextFormatFields() {
	const { t } = useTranslation();
	const [importMode, setImportMode] = useAtom(importModeAtom);
	const [lineSeparatorMode, setLineSeparatorMode] = useAtom(
		lineSeparatorModeAtom,
	);
	const [lineSeparator, setLineSeparator] = useAtom(lineSeparatorAtom);
	const [swapTransAndRoman, setSwapTransAndRoman] = useAtom(
		swapTransAndRomanAtom,
	);
	const [wordSeparator, setWordSeparator] = useAtom(wordSeparatorAtom);
	const [enableSpecialPrefix, setEnableSpecialPrefix] = useAtom(
		enableSpecialPrefixAtom,
	);
	const [bgLyricPrefix, setBgLyricPrefix] = useAtom(bgLyricPrefixAtom);
	const [duetLyricPrefix, setDuetLyricPrefix] = useAtom(duetLyricPrefixAtom);
	const lyricOnly = importMode === "lyric";

	return (
		<Flex direction="column" gap="2">
			<Flex direction="column" gap="1">
				<Text size="2" color="gray">
					{t("textImportDialog.contentMode.caption", "Text content")}
				</Text>
				<Select.Root
					value={importMode}
					onValueChange={(value) => setImportMode(value as ImportContentMode)}
				>
					<Select.Trigger
						aria-label={t(
							"textImportDialog.contentMode.caption",
							"Text content",
						)}
					/>
					<Select.Content>
						<Select.Item value="lyric">
							{t("textImportDialog.contentMode.lyric", "Lyrics only")}
						</Select.Item>
						<Select.Item value="lyric-trans">
							{t(
								"textImportDialog.contentMode.withTranslation",
								"Lyrics with translation",
							)}
						</Select.Item>
						<Select.Item value="lyric-roman">
							{t(
								"textImportDialog.contentMode.withRoman",
								"Lyrics with romanization",
							)}
						</Select.Item>
						<Select.Item value="lyric-trans-roman">
							{t(
								"textImportDialog.contentMode.withBoth",
								"Lyrics with translation and romanization",
							)}
						</Select.Item>
					</Select.Content>
				</Select.Root>
			</Flex>
			{!lyricOnly && (
				<>
					<Flex direction="column" gap="1">
						<Text size="2" color="gray">
							{t(
								"textImportDialog.separationMode.caption",
								"Translation and romanization layout",
							)}
						</Text>
						<Select.Root
							value={lineSeparatorMode}
							onValueChange={(value) =>
								setLineSeparatorMode(value as ImportLineSeparatorMode)
							}
						>
							<Select.Trigger
								aria-label={t(
									"textImportDialog.separationMode.caption",
									"Translation and romanization layout",
								)}
							/>
							<Select.Content>
								<Select.Item value="interleaved-line">
									{t(
										"textImportDialog.separationMode.multipleLine",
										"On separate lines",
									)}
								</Select.Item>
								<Select.Item value="same-line-separator">
									{t(
										"textImportDialog.separationMode.sameLine",
										"On the same line",
									)}
								</Select.Item>
							</Select.Content>
						</Select.Root>
					</Flex>
					{lineSeparatorMode === "same-line-separator" && (
						<Row label={t("textImportDialog.separator", "Line separator")}>
							<TextField.Root
								className={styles.shortField}
								value={lineSeparator}
								onChange={(event) =>
									setLineSeparator(event.currentTarget.value)
								}
							/>
						</Row>
					)}
					<Row
						label={t(
							"textImportDialog.swapTransAndRoman",
							"Swap translation and romanization lines",
						)}
					>
						<Switch
							checked={swapTransAndRoman}
							onCheckedChange={setSwapTransAndRoman}
						/>
					</Row>
				</>
			)}
			<Row label={t("textImportDialog.wordSeparator", "Word separator")}>
				<TextField.Root
					className={styles.shortField}
					value={wordSeparator}
					onChange={(event) => setWordSeparator(event.currentTarget.value)}
				/>
			</Row>
			<Row
				label={t("textImportDialog.enableSpecialPrefix", "Use line prefixes")}
			>
				<Switch
					checked={enableSpecialPrefix}
					onCheckedChange={setEnableSpecialPrefix}
				/>
			</Row>
			{enableSpecialPrefix && (
				<>
					<Row
						label={t(
							"textImportDialog.bgLyricPrefix",
							"Background line prefix",
						)}
					>
						<TextField.Root
							className={styles.shortField}
							value={bgLyricPrefix}
							onChange={(event) => setBgLyricPrefix(event.currentTarget.value)}
						/>
					</Row>
					<Row
						label={t("textImportDialog.duetLyricPrefix", "Duet line prefix")}
					>
						<TextField.Root
							className={styles.shortField}
							value={duetLyricPrefix}
							onChange={(event) =>
								setDuetLyricPrefix(event.currentTarget.value)
							}
						/>
					</Row>
				</>
			)}
		</Flex>
	);
}
