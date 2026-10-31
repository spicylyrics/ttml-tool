import { WarningRegular } from "@fluentui/react-icons";
import { Flex, Text, TextField } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { SectionCategorySelect } from "$/components/SectionCategorySelect";
import type { ReviewedSection } from "../logic/import-text";
import styles from "./SectionReviewPanel.module.css";

/** Inline review of the sections an import will create. */
export function SectionReviewPanel({
	sections,
	wordSeparator,
	onChange,
}: {
	sections: ReviewedSection[];
	/** Hidden from the line preview so split marks don't clutter it. */
	wordSeparator: string;
	onChange: (occurrence: number, patch: Partial<ReviewedSection>) => void;
}) {
	const { t } = useTranslation();
	return (
		<Flex direction="column" gap="3">
			<Flex direction="column" gap="1">
				<Text size="2" weight="medium">
					{t("sectionImportReview.title", "Review detected sections")}
				</Text>
				<Text size="1" className={styles.hint}>
					{t(
						"importLyrics.reviewHint",
						"Fix any category that was guessed wrong. Colors, vocalists and notes can be set later from the section menu.",
					)}
				</Text>
			</Flex>
			{sections.map((section) => {
				const unsure = (section.confidence ?? 1) < 0.6;
				return (
					<Flex
						key={section.occurrence}
						direction="column"
						gap="2"
						className={styles.section}
						data-unsure={unsure || undefined}
					>
						<Flex gap="2" align="center">
							<TextField.Root
								size="1"
								className={styles.label}
								aria-label={t("importLyrics.sectionLabel", "Section label")}
								value={section.label}
								onChange={(event) =>
									onChange(section.occurrence, { label: event.target.value })
								}
							/>
							<SectionCategorySelect
								value={section.category}
								onValueChange={(category) =>
									onChange(section.occurrence, { category, confidence: 1 })
								}
								aria-label={t(
									"importLyrics.sectionCategory",
									"Section category",
								)}
							/>
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
									{t(
										"importLyrics.lowConfidence",
										"Category guessed. Check it.",
									)}
								</Text>
							</Flex>
						)}
					</Flex>
				);
			})}
		</Flex>
	);
}
