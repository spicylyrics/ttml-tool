import { Card, Flex, Switch, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { BrandMark } from "$/components/BrandBand";
import { OptionPicker, type PickerOption } from "$/components/OptionPicker";
import { spicyLyricsDesignAtom } from "$/modules/settings/states/index.ts";
import styles from "./index.module.css";
import {
	DEFAULT_CUSTOM_LOGO_COLOR,
	isHexColor,
	type LogoColorPreset,
} from "./presets";
import {
	logoColorCustomAtom,
	logoColorEnabledAtom,
	logoColorPresetAtom,
} from "./states";

export const LogoColorSection = () => {
	const { t } = useTranslation();
	const [enabled, setEnabled] = useAtom(logoColorEnabledAtom);
	const [preset, setPreset] = useAtom(logoColorPresetAtom);
	const [custom, setCustom] = useAtom(logoColorCustomAtom);
	const spicyLyricsDesign = useAtomValue(spicyLyricsDesignAtom);

	const options: PickerOption<LogoColorPreset>[] = [
		{
			value: "default",
			label: t("logoColor.presets.default", "Default"),
			description: t("logoColor.presets.defaultDesc", "The design's own color"),
		},
		{
			value: "lilac",
			label: t("logoColor.presets.lilac", "Lilac"),
			description: t("logoColor.presets.lilacDesc", "From the v3 logo"),
		},
		{
			value: "purple",
			label: t("logoColor.presets.purple", "Purple"),
			description: t(
				"logoColor.presets.purpleDesc",
				"From the multicolor logo",
			),
		},
		{
			value: "red",
			label: t("logoColor.presets.red", "Red"),
			description: t("logoColor.presets.redDesc", "From the v0.9 logo"),
		},
		{ value: "gold", label: t("logoColor.presets.gold", "Gold") },
		{ value: "green", label: t("logoColor.presets.green", "Green") },
		{ value: "blue", label: t("logoColor.presets.blue", "Blue") },
		{ value: "white", label: t("logoColor.presets.white", "White") },
		{
			value: "custom",
			label: t("logoColor.presets.custom", "Custom"),
			description: t("logoColor.presets.customDesc", "Pick any color"),
		},
	];

	return (
		<Card>
			<Flex direction="column" gap="3">
				<Flex align="center" justify="between" gap="4">
					<Flex direction="column" gap="1">
						<Text as="label" htmlFor="logo-color-switch" weight="medium">
							{t("logoColor.title", "Logo color")}
						</Text>
						<Text size="1" color="gray">
							{t(
								"logoColor.description",
								"Experimental. Pick a color for the logo in the title bar and on the guide's welcome screen.",
							)}
						</Text>
					</Flex>
					<Switch
						id="logo-color-switch"
						checked={enabled}
						onCheckedChange={setEnabled}
					/>
				</Flex>
				{enabled && (
					<>
						<Flex align="center" justify="between" gap="4">
							<Flex align="center" gap="3">
								<BrandMark className={styles.preview} />
								<Text size="2">{t("logoColor.colorLabel", "Color")}</Text>
							</Flex>
							<Flex align="center" gap="2">
								{preset === "custom" && (
									<input
										type="color"
										className={styles.colorInput}
										aria-label={t("logoColor.customLabel", "Custom logo color")}
										value={(isHexColor(custom)
											? custom
											: DEFAULT_CUSTOM_LOGO_COLOR
										).toLowerCase()}
										onChange={(event) => setCustom(event.target.value)}
									/>
								)}
								<OptionPicker
									value={preset}
									options={options}
									onValueChange={setPreset}
									label={t("logoColor.colorLabel", "Color")}
									size="2"
								/>
							</Flex>
						</Flex>
						{!spicyLyricsDesign && (
							<Text size="1" color="gray">
								{t(
									"logoColor.designNote",
									"The logo only shows with the Spicy Lyrics design on.",
								)}
							</Text>
						)}
					</>
				)}
			</Flex>
		</Card>
	);
};
