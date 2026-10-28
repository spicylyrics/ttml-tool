import { TextEditStyle24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { editAsTextEnabledAtom } from "../states";

/** Preferences row for the Edit as text feature flag. */
export const EditAsTextSetting = () => {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(editAsTextEnabledAtom);
	return (
		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<TextEditStyle24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="1">
							<Flex align="center" justify="between" gap="4">
								<Text>{t("editAsText.setting", "Edit as text")}</Text>
								<Switch checked={enabled} onCheckedChange={setEnabled} />
							</Flex>
							<Text size="1" color="gray">
								{t(
									"editAsText.settingDesc",
									"Adds Edit as text to the Edit menu: change the whole lyrics as plain text and keep the timing of words you don't touch.",
								)}
							</Text>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>
	);
};
