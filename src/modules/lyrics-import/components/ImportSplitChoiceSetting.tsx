import { TextWordCount24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { importSplitChoiceEnabledAtom } from "../flags";

/** Preferences row for the import screen's "Split now" choice. */
export function ImportSplitChoiceSetting() {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(importSplitChoiceEnabledAtom);
	return (
		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<TextWordCount24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="1">
							<Flex align="center" justify="between" gap="4">
								<Text>
									{t("importSplit.setting", "Split syllables while importing")}
								</Text>
								<Switch checked={enabled} onCheckedChange={setEnabled} />
							</Flex>
							<Text size="1" color="gray">
								{t(
									"importSplit.settingHint",
									"Adds a Split now or I'll split later choice to the import screen. Split now marks syllables with your segmentation settings and learned splits, and you can fix them before importing.",
								)}
							</Text>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>
	);
}
