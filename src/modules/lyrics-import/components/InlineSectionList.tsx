import { MergeRegular, WarningRegular } from "@fluentui/react-icons";
import {
	Flex,
	IconButton,
	Select,
	Text,
	TextField,
	Tooltip,
} from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	LYRIC_SECTION_CATEGORIES,
	type LyricSectionCategory,
} from "$/types/ttml";
import { importInlineSectionsEnabledAtom } from "../inline-sections-flag";
import type { InlineSection } from "../logic/inline-sections";
import styles from "./InlineSectionList.module.css";

/** Whether the import screen edits sections inline (experimental flag). */
export const useInlineSectionsEnabled = () =>
	useAtomValue(importInlineSectionsEnabledAtom);

/**
 * The detected sections, read from the import text and edited in it: renaming,
 * changing a category or merging rewrites the header row the editor shows.
 */
export function InlineSectionList({
	sections,
	wordSeparator,
	onRename,
	onRetype,
	onMergeUp,
}: {
	sections: InlineSection[];
	/** Hidden from the line preview so split marks don't clutter it. */
	wordSeparator: string;
	onRename: (lineIndex: number, name: string) => void;
	onRetype: (lineIndex: number, category: LyricSectionCategory) => void;
	onMergeUp: (lineIndex: number) => void;
}) {
	const { t } = useTranslation();
	return (
		<Flex direction="column" gap="3" mt="4">
			<Flex direction="column" gap="1">
				<Text size="2" weight="medium">
					{t("importInlineSections.title", "Sections")}
				</Text>
				<Text size="1" className={styles.hint}>
					{t(
						"importInlineSections.hint",
						"Changes here rewrite the header rows in the text.",
					)}
				</Text>
			</Flex>
			{sections.map((section, index) => (
				<InlineSectionRow
					key={`${index}:${section.lineIndex}`}
					section={section}
					canMerge={index > 0}
					wordSeparator={wordSeparator}
					onRename={onRename}
					onRetype={onRetype}
					onMergeUp={onMergeUp}
				/>
			))}
		</Flex>
	);
}

function InlineSectionRow({
	section,
	canMerge,
	wordSeparator,
	onRename,
	onRetype,
	onMergeUp,
}: {
	section: InlineSection;
	canMerge: boolean;
	wordSeparator: string;
	onRename: (lineIndex: number, name: string) => void;
	onRetype: (lineIndex: number, category: LyricSectionCategory) => void;
	onMergeUp: (lineIndex: number) => void;
}) {
	const { t } = useTranslation();
	// Typing keeps a draft so clearing the field doesn't remove the header.
	const [draft, setDraft] = useState(section.text);
	useEffect(() => setDraft(section.text), [section.text]);
	const commit = () => {
		if (draft.trim() && draft !== section.text)
			onRename(section.lineIndex, draft);
		else setDraft(section.text);
	};
	const unsure = section.confidence < 0.6;
	const mergeLabel = t(
		"importInlineSections.mergeUp",
		"Merge into the section above",
	);
	return (
		<Flex
			direction="column"
			gap="2"
			className={styles.section}
			data-unsure={unsure || undefined}
		>
			<Flex gap="2" align="center">
				<TextField.Root
					size="1"
					className={styles.label}
					aria-label={t("lyricMarkup.headerText", "Header text")}
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={commit}
					onKeyDown={(event) => {
						if (event.key === "Enter") commit();
					}}
				/>
				<Select.Root
					size="1"
					value={section.category}
					onValueChange={(category) =>
						onRetype(section.lineIndex, category as LyricSectionCategory)
					}
				>
					<Select.Trigger aria-label={t("lyricMarkup.category", "Category")} />
					<Select.Content>
						{LYRIC_SECTION_CATEGORIES.map((category) => (
							<Select.Item key={category} value={category}>
								{category}
							</Select.Item>
						))}
					</Select.Content>
				</Select.Root>
				{canMerge && (
					<Tooltip content={mergeLabel}>
						<IconButton
							size="1"
							variant="ghost"
							color="gray"
							aria-label={mergeLabel}
							onClick={() => onMergeUp(section.lineIndex)}
						>
							<MergeRegular />
						</IconButton>
					</Tooltip>
				)}
			</Flex>
			<Flex gap="2" align="center" justify="between">
				<Text size="1" color="gray" truncate>
					{wordSeparator
						? section.firstLine?.split(wordSeparator).join("")
						: section.firstLine}
				</Text>
				<Text size="1" color="gray" className={styles.count}>
					{t(
						"sectionImportReview.lineCount",
						"{count, plural, one {# lyric line} other {# lyric lines}}",
						{ count: section.lineCount },
					)}
				</Text>
			</Flex>
			{unsure && (
				<Flex gap="1" align="center">
					<WarningRegular className={styles.warning} aria-hidden />
					<Text size="1" className={styles.warning}>
						{t("importLyrics.lowConfidence", "Category guessed. Check it.")}
					</Text>
				</Flex>
			)}
		</Flex>
	);
}
