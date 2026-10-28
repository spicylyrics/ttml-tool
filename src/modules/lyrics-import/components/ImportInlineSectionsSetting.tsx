import { TextBulletListSquare24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { importInlineSectionsEnabledAtom } from "../inline-sections-flag";

/** Preferences row for the experimental inline section review. */
export function ImportInlineSectionsSetting() {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(importInlineSectionsEnabledAtom);
	return (
		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<TextBulletListSquare24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="1">
							<Flex align="center" justify="between" gap="4">
								<Text>
									{t(
										"importInlineSections.setting",
										"Edit sections next to the import text (experimental)",
									)}
								</Text>
								<Switch checked={enabled} onCheckedChange={setEnabled} />
							</Flex>
							<Text size="1" color="gray">
								{t(
									"importInlineSections.settingDesc",
									"List detected sections beside the lyrics on the import screen and import in one step, without the Review sections step.",
								)}
							</Text>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>
	);
}
