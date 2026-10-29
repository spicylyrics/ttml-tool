import { ClockRegular } from "@fluentui/react-icons";
import {
	Flex,
	IconButton,
	Popover,
	Select,
	Slider,
	Switch,
	Text,
	Tooltip,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import {
	showWordTimingCueAtom,
	wordTimingClicksAtom,
	wordTimingClickVolumeAtom,
	wordTimingCueModeAtom,
} from "./states";

export function WordCueSettings() {
	const { t } = useTranslation();
	const [visible, setVisible] = useAtom(showWordTimingCueAtom);
	const [clicks, setClicks] = useAtom(wordTimingClicksAtom);
	const [cueMode, setCueMode] = useAtom(wordTimingCueModeAtom);
	const [volume, setVolume] = useAtom(wordTimingClickVolumeAtom);
	return (
		<Flex direction="column" gap="3" style={{ maxWidth: 360 }}>
			<Text weight="bold">{t("wordCue.title", "Word timing cues")}</Text>
			<Flex align="center" justify="between" gap="4" asChild>
				<label>
					<Text size="2">{t("wordCue.show", "Show timing indicator")}</Text>
					<Switch checked={visible} onCheckedChange={setVisible} />
				</label>
			</Flex>
			<Flex align="center" justify="between" gap="4" asChild>
				<label>
					<Text size="2">{t("wordCue.clicks", "Word/syllable clicks")}</Text>
					<Switch checked={clicks} onCheckedChange={setClicks} />
				</label>
			</Flex>
			{clicks && (
				<Flex align="center" justify="between" gap="4">
					<Text size="2">{t("wordCue.cueMode", "Cue by")}</Text>
					<Select.Root
						value={cueMode}
						onValueChange={(value) =>
							setCueMode(value === "syllable" ? "syllable" : "word")
						}
					>
						<Select.Trigger />
						<Select.Content>
							<Select.Item value="word">
								{t("wordCue.wholeWord", "Whole word")}
							</Select.Item>
							<Select.Item value="syllable">
								{t("wordCue.eachSyllable", "Each syllable")}
							</Select.Item>
						</Select.Content>
					</Select.Root>
				</Flex>
			)}
			{clicks && (
				<Text size="1" color="gray">
					{t(
						cueMode === "syllable"
							? "wordCue.syllableDescription"
							: "wordCue.wordDescription",
						cueMode === "syllable"
							? "Click at the start of each timed span. Split words use syllable timings; unsplit words get one click for the whole word. Background vocals are quieter; duet vocals use a distinct higher beep. Cue volume is independent of music volume."
							: "High click at word start, low click at word end. Background vocals are quieter; duet vocals use a distinct higher beep. Cue volume is independent of music volume.",
					)}
				</Text>
			)}
			<Flex align="center" gap="3">
				<Text size="2">{t("wordCue.volume", "Cue volume")}</Text>
				<Slider
					aria-label={t("wordCue.volume", "Cue volume")}
					style={{ flex: 1, minWidth: 80 }}
					min={0}
					max={1}
					step={0.01}
					value={[volume]}
					disabled={!clicks}
					onValueChange={([value]) => setVolume(value)}
				/>
				<Text size="1" style={{ minWidth: "3em", textAlign: "right" }}>
					{Math.round(volume * 100)}%
				</Text>
			</Flex>
		</Flex>
	);
}

export function WordCueOptions() {
	const { t } = useTranslation();
	return (
		<Popover.Root>
			<Tooltip content={t("wordCue.title", "Word timing cues")}>
				<Popover.Trigger>
					<IconButton
						variant="soft"
						aria-label={t("wordCue.title", "Word timing cues")}
					>
						<ClockRegular />
					</IconButton>
				</Popover.Trigger>
			</Tooltip>
			<Popover.Content>
				<WordCueSettings />
			</Popover.Content>
		</Popover.Root>
	);
}
