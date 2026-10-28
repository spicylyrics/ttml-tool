import { Speaker224Regular, TopSpeed24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Heading, Slider, Text } from "@radix-ui/themes";
import {
	MAX_PLAYBACK_RATE,
	MIN_PLAYBACK_RATE,
} from "$/modules/audio/utils/playback-rate";
import { BpmDisplaySetting } from "$/modules/bpm/components/BpmDisplaySetting";
import type { CommonSettings } from "./useCommonSettings";
export const PlaybackSection = ({
	volume,
	setVolume,
	playbackRate,
	setPlaybackRate,
	t,
}: Pick<
	CommonSettings,
	"volume" | "setVolume" | "playbackRate" | "setPlaybackRate" | "t"
>) => (
	<Flex direction="column" gap="2">
		<Heading size="4">{t("settings.group.playback", "Playback")}</Heading>

		<Card>
			<Flex gap="3" align="center">
				<Speaker224Regular />
				<Box flexGrow="1">
					<Flex direction="column" gap="2" align="start">
						<Flex
							align="center"
							justify="between"
							style={{ alignSelf: "stretch" }}
						>
							<Text>{t("settings.common.volume", "Music volume")}</Text>
							<Text wrap="nowrap" color="gray" size="1">
								{(volume * 100).toFixed()}%
							</Text>
						</Flex>
						<Slider
							min={0}
							max={1}
							value={[volume]}
							step={0.01}
							onValueChange={(v) => setVolume(v[0])}
						/>
					</Flex>
				</Box>
			</Flex>
		</Card>

		<Card>
			<Flex gap="3" align="center">
				<TopSpeed24Regular />
				<Box flexGrow="1">
					<Flex direction="column" gap="2" align="start">
						<Flex
							align="center"
							justify="between"
							style={{ alignSelf: "stretch" }}
						>
							<Text>{t("settings.common.playbackRate", "Playback speed")}</Text>
							<Text wrap="nowrap" color="gray" size="1">
								{playbackRate.toFixed(2)}x
							</Text>
						</Flex>
						<Slider
							min={MIN_PLAYBACK_RATE}
							max={MAX_PLAYBACK_RATE}
							value={[playbackRate]}
							step={0.05}
							onValueChange={(v) => setPlaybackRate(v[0])}
						/>
					</Flex>
				</Box>
			</Flex>
		</Card>

		<BpmDisplaySetting />
	</Flex>
);
