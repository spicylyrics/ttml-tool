import { MicSparkle24Regular, TextQuote24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Heading, Switch, Text } from "@radix-ui/themes";
import { SlIcon } from "$/components/SlIcon";
import type { CommonSettings } from "./useCommonSettings";
export const ImportCleanupSection = ({
	normalizeApostrophesOnImport,
	setNormalizeApostrophesOnImport,
	normalizeCyrillicEsOnImport,
	setNormalizeCyrillicEsOnImport,
	allowConsecutiveBackgroundLines,
	setAllowConsecutiveBackgroundLines,
	t,
}: Pick<
	CommonSettings,
	| "normalizeApostrophesOnImport"
	| "setNormalizeApostrophesOnImport"
	| "normalizeCyrillicEsOnImport"
	| "setNormalizeCyrillicEsOnImport"
	| "allowConsecutiveBackgroundLines"
	| "setAllowConsecutiveBackgroundLines"
	| "t"
>) => (
	<Flex direction="column" gap="2">
		<Heading size="4">{t("settings.group.import", "Import & export")}</Heading>

		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<TextQuote24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="1">
							<Flex align="center" justify="between" gap="4">
								<Text>
									{t(
										"settings.common.normalizeApostrophesOnImport",
										"Normalize apostrophes",
									)}
								</Text>
								<Switch
									checked={normalizeApostrophesOnImport}
									onCheckedChange={setNormalizeApostrophesOnImport}
								/>
							</Flex>
							<Text size="1" color="gray">
								{t(
									"settings.common.normalizeApostrophesOnImportDesc",
									"Convert curly and other apostrophe-like characters during import and export.",
								)}
							</Text>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>

		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<SlIcon name="translation" size={24} />
					<Box flexGrow="1">
						<Flex direction="column" gap="1">
							<Flex align="center" justify="between" gap="4">
								<Text>
									{t(
										"settings.common.normalizeCyrillicEsOnImport",
										"Fix stray Cyrillic Е/е in Latin words",
									)}
								</Text>
								<Switch
									checked={normalizeCyrillicEsOnImport}
									onCheckedChange={setNormalizeCyrillicEsOnImport}
								/>
							</Flex>
							<Text size="1" color="gray">
								{t(
									"settings.common.normalizeCyrillicEsOnImportDesc",
									"Correct hidden Cyrillic lookalikes in Latin words during import and export.",
								)}
							</Text>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>

		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<MicSparkle24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="1">
							<Flex align="center" justify="between" gap="4">
								<Text>
									{t(
										"settings.common.allowConsecutiveBackgroundLines",
										"Allow consecutive and standalone background vocals",
									)}
								</Text>
								<Switch
									checked={allowConsecutiveBackgroundLines}
									onCheckedChange={setAllowConsecutiveBackgroundLines}
								/>
							</Flex>
							<Text size="1" color="gray">
								{t(
									"settings.common.allowConsecutiveBackgroundLinesDesc",
									"Export consecutive background vocals together and preserve standalone background vocals for Spicy Lyrics compatibility. Other players may not support this structure.",
								)}
							</Text>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>
	</Flex>
);
