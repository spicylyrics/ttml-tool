import { Drag24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Text } from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { scrubAudioAtom } from "$/modules/audio/states";
import { SettingToggle } from "$/modules/settings/components/WorkflowControls";

/** Whether dragging the playhead plays the song under the pointer. */
export const ScrubAudioSetting = () => {
	const { t } = useTranslation();
	return (
		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<Drag24Regular />
					<Box flexGrow="1">
						<Flex gap="2" align="center" justify="between">
							<Flex direction="column" gap="1">
								<Text>
									{t("settings.common.scrubAudio", "Hear audio while dragging")}
								</Text>
								<Text size="1" color="gray">
									{t(
										"settings.common.scrubAudioDesc",
										"Plays the song under the playhead as you drag it in the audio bar or spectrogram. Follows Preserve pitch.",
									)}
								</Text>
							</Flex>
							<SettingToggle setting={scrubAudioAtom} />
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>
	);
};
