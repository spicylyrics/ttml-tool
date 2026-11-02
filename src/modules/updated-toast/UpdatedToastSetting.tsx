import { History24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { showUpdatedToastAtom } from "$/modules/settings/states";

export const UpdatedToastSetting = () => {
	const [enabled, setEnabled] = useAtom(showUpdatedToastAtom);
	const { t } = useTranslation();

	return (
		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<History24Regular />
					<Box flexGrow="1">
						<Flex gap="2" align="center" justify="between">
							<Flex direction="column" gap="1">
								<Text>
									{t(
										"updatedToast.setting",
										"Show what changed after an update",
									)}
								</Text>
								<Text size="1" color="gray">
									{t(
										"updatedToast.settingDesc",
										"The first time the app starts on a new version, show a short notice with a link to the changelog.",
									)}
								</Text>
							</Flex>
							<Switch checked={enabled} onCheckedChange={setEnabled} />
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>
	);
};
