import { Card, Flex, Heading, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
	enableManualTimestampEditAtom,
	quickFixesAtom,
	highlightErrorsAtom,
} from "$/modules/settings/states";
import { visualizeTimestampUpdateAtom } from "$/modules/settings/states/sync";
import { Sparkle24Regular, TimeAndWeather24Regular, ErrorCircle24Regular, TextT24Regular } from "@fluentui/react-icons";

export const SettingsAssistantTab = () => {
	const [quickFixes, setQuickFixes] = useAtom(quickFixesAtom);
	const [enableManualTimestampEdit, setEnableManualTimestampEdit] = useAtom(
		enableManualTimestampEditAtom,
	);
	const [visualizeTimestampUpdate, setVisualizeTimestampUpdate] = useAtom(
		visualizeTimestampUpdateAtom,
	);
	const [highlightErrors, setHighlightErrors] = useAtom(highlightErrorsAtom);
	const { t } = useTranslation();

	return (
		<Flex direction="column" gap="4">
			<Heading size="4">{t("settings.group.assistant", "Assistant")}</Heading>

			<Card>
				<Text as="label">
					<Flex gap="3" align="center">
						<Sparkle24Regular />
						<Box flexGrow="1">
							<Flex gap="2" align="center" justify="between">
								<Flex direction="column" gap="1">
									<Text>{t("settings.assistant.quickFixes", "Quick Fixes (Grammar)")}</Text>
									<Text size="1" color="gray">
										{t("settings.assistant.quickFixesDesc", "Enable suggestions for repeated words and common transcription errors.")}
									</Text>
								</Flex>
								<Switch checked={quickFixes} onCheckedChange={setQuickFixes} />
							</Flex>
						</Box>
					</Flex>
				</Text>
			</Card>

			<Card>
				<Text as="label">
					<Flex gap="3" align="center">
						<TextT24Regular />
						<Box flexGrow="1">
							<Flex gap="2" align="center" justify="between">
								<Flex direction="column" gap="1">
									<Text>{t("settings.assistant.manualTimestampEdit", "Manual Timestamp Editing")}</Text>
									<Text size="1" color="gray">
										{t("settings.assistant.manualTimestampEditDesc", "Allow clicking on timestamps in Sync mode to manually type values.")}
									</Text>
								</Flex>
								<Switch
									checked={enableManualTimestampEdit}
									onCheckedChange={setEnableManualTimestampEdit}
								/>
							</Flex>
						</Box>
					</Flex>
				</Text>
			</Card>

			<Card>
				<Text as="label">
					<Flex gap="3" align="center">
						<TimeAndWeather24Regular />
						<Box flexGrow="1">
							<Flex gap="2" align="center" justify="between">
								<Flex direction="column" gap="1">
									<Text>{t("settings.assistant.visualizeTimestampUpdate", "Visualize Timestamp Updates")}</Text>
									<Text size="1" color="gray">
										{t("settings.assistant.visualizeTimestampUpdateDesc", "Show a brief flash on timestamps when they are updated via shortcuts.")}
									</Text>
								</Flex>
								<Switch
									checked={visualizeTimestampUpdate}
									onCheckedChange={setVisualizeTimestampUpdate}
								/>
							</Flex>
						</Box>
					</Flex>
				</Text>
			</Card>

			<Card>
				<Text as="label">
					<Flex gap="3" align="center">
						<ErrorCircle24Regular />
						<Box flexGrow="1">
							<Flex gap="2" align="center" justify="between">
								<Flex direction="column" gap="1">
									<Text>{t("settings.assistant.highlightErrors", "Highlight Timing Errors")}</Text>
									<Text size="1" color="gray">
										{t("settings.assistant.highlightErrorsDesc", "Visually mark words where start time is greater than end time.")}
									</Text>
								</Flex>
								<Switch checked={highlightErrors} onCheckedChange={setHighlightErrors} />
							</Flex>
						</Box>
					</Flex>
				</Text>
			</Card>
		</Flex>
	);
};

// Also export Box for consistent imports
import { Box as RadixBox } from "@radix-ui/themes";
const Box = RadixBox;
