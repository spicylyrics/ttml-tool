import { Pulse24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import type { FC } from "react";
import { useTranslation } from "react-i18next";
import { bpmDisplayEnabledAtom } from "../states";

/** Preferences card for the tempo readout flag. */
export const BpmDisplaySetting: FC = () => {
	const [enabled, setEnabled] = useAtom(bpmDisplayEnabledAtom);
	const { t } = useTranslation();
	return (
		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<Pulse24Regular />
					<Box flexGrow="1">
						<Flex gap="2" align="center" justify="between">
							<Flex direction="column" gap="1">
								<Text>{t("bpm.setting", "Show estimated tempo")}</Text>
								<Text size="1" color="gray">
									{t(
										"bpm.settingDesc",
										"Estimates the song's BPM after the audio loads and shows it in the Time ribbon.",
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
