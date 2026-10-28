import { PanelRight24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { referenceSidebarEnabledAtom } from "./states";

/** Preferences row for the reference sidebar flag. */
export const ReferenceSidebarSetting = () => {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(referenceSidebarEnabledAtom);
	return (
		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<PanelRight24Regular />
					<Box flexGrow="1">
						<Flex align="center" justify="between" gap="4">
							<Flex direction="column" gap="1">
								<Text>
									{t("referenceSidebar.setting", "Reference sidebar")}
								</Text>
								<Text size="1" color="gray">
									{t(
										"referenceSidebar.settingDesc",
										"Dock the preview and the song's Genius lyrics on the right in Edit and Time mode. Replaces the Preview panel.",
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
