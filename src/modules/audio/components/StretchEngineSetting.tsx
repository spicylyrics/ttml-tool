import { SoundWaveCircle24Regular } from "@fluentui/react-icons";
import { Card, Flex, Text } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { OptionPicker, type PickerOption } from "$/components/OptionPicker";
import { stretchEngineAtom } from "$/modules/audio/states";
import type { StretchEngine } from "$/modules/audio/worklet/protocol";

/** Picks how slowed or sped-up audio keeps its pitch. */
export const StretchEngineSetting = () => {
	const { t } = useTranslation();
	const [engine, setEngine] = useAtom(stretchEngineAtom);
	const title = t("settings.common.stretchEngine", "Pitch-preserved playback");
	const options: PickerOption<StretchEngine>[] = [
		{
			value: "signalsmith",
			label: t("settings.common.stretchEngineClearer", "Clearer"),
			description: t(
				"settings.common.stretchEngineClearerDesc",
				"Cleaner vocals when slowed down, uses a bit more CPU",
			),
		},
		{
			value: "soundtouch",
			label: t("settings.common.stretchEngineLighter", "Lighter"),
			description: t(
				"settings.common.stretchEngineLighterDesc",
				"The previous engine, try it if playback stutters",
			),
		},
	];

	return (
		<Card>
			<Flex gap="3" align="center">
				<SoundWaveCircle24Regular />
				<Flex direction="column" gap="1" flexGrow="1" minWidth="0">
					<Text>{title}</Text>
					<Text size="1" color="gray">
						{t(
							"settings.common.stretchEngineDesc",
							"Used when Preserve pitch is on and the speed isn't 1x.",
						)}
					</Text>
				</Flex>
				<OptionPicker
					value={engine}
					options={options}
					onValueChange={setEngine}
					label={title}
					size="2"
				/>
			</Flex>
		</Card>
	);
};
