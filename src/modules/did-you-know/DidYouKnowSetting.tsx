import { Lightbulb24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { SettingToggle } from "$/modules/settings/components/WorkflowControls";
import { didYouKnowEnabledAtom, TIPS_RELEASED } from "./states";

export const DidYouKnowSetting = () => {
	const { t } = useTranslation();
	if (!TIPS_RELEASED) return null;
	return (
		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<Lightbulb24Regular />
					<Box flexGrow="1">
						<Flex gap="2" align="center" justify="between">
							<Flex direction="column" gap="1">
								<Text>{t("didYouKnow.setting", "Show tips")}</Text>
								<Text size="1" color="gray">
									{t(
										"didYouKnow.settingDesc",
										"After you do something by hand that has a faster way, show a short tip about it. Each tip shows once.",
									)}
								</Text>
							</Flex>
							<SettingToggle setting={didYouKnowEnabledAtom} />
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>
	);
};
