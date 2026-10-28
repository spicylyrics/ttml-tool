import {
	Beaker24Regular,
	LocalLanguage24Regular,
	TextWordCount24Regular,
	Translate24Regular,
} from "@fluentui/react-icons";
import { Box, Card, Flex, Heading, Text, TextField } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { OptionPicker } from "$/components/OptionPicker";
import { SettingToggle } from "$/modules/settings/components/WorkflowControls";
import {
	japaneseGranularitySettingAtom,
	romanizationToolsFlagAtom,
	type TranslationExportFormat,
	translationExportFormatSettingAtom,
	translationLanguageSettingAtom,
} from "./states";

const Row = ({
	icon,
	title,
	description,
	children,
	asLabel,
}: {
	icon: ReactNode;
	title: string;
	description: string;
	children: ReactNode;
	asLabel?: boolean;
}) => {
	const row = (
		<Flex gap="3" align="center">
			{icon}
			<Box flexGrow="1">
				<Flex align="center" justify="between" gap="4">
					<Flex direction="column" gap="1">
						<Text>{title}</Text>
						<Text size="1" color="gray">
							{description}
						</Text>
					</Flex>
					{children}
				</Flex>
			</Box>
		</Flex>
	);
	return <Card>{asLabel ? <Text as="label">{row}</Text> : row}</Card>;
};

/** Preferences → Workflow group for the experimental romanization tools. */
export const RomanizationToolsSettings = () => {
	const { t } = useTranslation();
	const enabled = useAtomValue(romanizationToolsFlagAtom);
	const [granularity, setGranularity] = useAtom(japaneseGranularitySettingAtom);
	const [format, setFormat] = useAtom(translationExportFormatSettingAtom);
	const [language, setLanguage] = useAtom(translationLanguageSettingAtom);
	const granularityLabel = t(
		"romanizationTools.japaneseGranularity",
		"Japanese split size",
	);
	const formatLabel = t(
		"romanizationTools.translationFormat",
		"Translation export",
	);
	const languageLabel = t(
		"romanizationTools.translationLanguage",
		"Translation language",
	);

	return (
		<Flex direction="column" gap="3">
			<Heading size="4">
				{t("romanizationTools.group", "Romanization and splitting")}
			</Heading>
			<Row
				icon={<Beaker24Regular />}
				title={t("romanizationTools.flag", "Experimental romanization tools")}
				description={t(
					"romanizationTools.flagDesc",
					"Rule-based English splitting, Japanese split size, pasting a romanized page and a head-level translation export.",
				)}
				asLabel
			>
				<SettingToggle setting={romanizationToolsFlagAtom} />
			</Row>
			{enabled && (
				<>
					<Row
						icon={<TextWordCount24Regular />}
						title={granularityLabel}
						description={t(
							"romanizationTools.japaneseGranularityDesc",
							"How Auto split cuts Japanese lyrics. Small kana, ー and っ stay with their sound.",
						)}
					>
						<OptionPicker
							label={granularityLabel}
							value={granularity}
							onValueChange={setGranularity}
							options={[
								{
									value: "syllable",
									label: t(
										"romanizationTools.granularity.syllable",
										"Syllable",
									),
									description: t(
										"romanizationTools.granularity.syllableDesc",
										"One sound per part, ん joins the sound before it",
									),
								},
								{
									value: "mora",
									label: t("romanizationTools.granularity.mora", "Mora"),
									description: t(
										"romanizationTools.granularity.moraDesc",
										"One beat per part, ん is its own part",
									),
								},
								{
									value: "word",
									label: t("romanizationTools.granularity.word", "Word"),
									description: t(
										"romanizationTools.granularity.wordDesc",
										"Whole words",
									),
								},
							]}
						/>
					</Row>
					<Row
						icon={<Translate24Regular />}
						title={formatLabel}
						description={t(
							"romanizationTools.translationFormatDesc",
							"Where translations go in exported TTML. Spicy Lyrics reads inline translations only.",
						)}
					>
						<OptionPicker<TranslationExportFormat>
							label={formatLabel}
							value={format}
							onValueChange={setFormat}
							options={[
								{
									value: "inline",
									label: t("romanizationTools.format.inline", "Inline"),
									description: t(
										"romanizationTools.format.inlineDesc",
										"In each line, as before. Spicy Lyrics reads this.",
									),
								},
								{
									value: "head",
									label: t("romanizationTools.format.head", "Head"),
									description: t(
										"romanizationTools.format.headDesc",
										"Apple-style, in the file head. Spicy Lyrics may show it as romanization.",
									),
								},
							]}
						/>
					</Row>
					{format === "head" && (
						<Row
							icon={<LocalLanguage24Regular />}
							title={languageLabel}
							description={t(
								"romanizationTools.translationLanguageDesc",
								"Language tag for head-level translations, like en or es.",
							)}
						>
							<TextField.Root
								aria-label={languageLabel}
								value={language}
								style={{ width: 80 }}
								onChange={(event) => setLanguage(event.target.value.trim())}
							/>
						</Row>
					)}
				</>
			)}
		</Flex>
	);
};
