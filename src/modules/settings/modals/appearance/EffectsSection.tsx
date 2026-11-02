import { Card, Flex, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { OptionPicker } from "$/components/OptionPicker";
import { effectsModeAtom, liteEffectsAtom } from "$/modules/settings/states";
import type { AppearanceSectionState } from "./sectionState";

/**
 * A machine setting rather than a look, so it stays out of presets and the
 * appearance reset.
 */
export const EffectsSection = ({ t }: Pick<AppearanceSectionState, "t">) => {
	const [mode, setMode] = useAtom(effectsModeAtom);
	const lite = useAtomValue(liteEffectsAtom);
	const title = t("settings.appearance.effects.title", "Visual effects");

	return (
		<Card>
			<Flex direction="column" gap="3">
				<Flex direction="column" gap="1">
					<Text weight="medium">{title}</Text>
					<Text size="1" color="gray">
						{t(
							"settings.appearance.effects.description",
							"Lighter drops blur, glows, dialog animations and the moving preview background, so the app stays smooth where they render slowly. It also turns off glass blur.",
						)}
					</Text>
				</Flex>
				<OptionPicker
					variant="segmented"
					size="2"
					value={mode}
					onValueChange={setMode}
					label={title}
					options={[
						{
							value: "auto",
							label: t("settings.appearance.effects.auto", "Automatic"),
						},
						{
							value: "full",
							label: t("settings.appearance.effects.full", "Full"),
						},
						{
							value: "lite",
							label: t("settings.appearance.effects.lite", "Lighter"),
						},
					]}
				/>
				{mode === "auto" && (
					<Text size="1" color="gray">
						{lite
							? t(
									"settings.appearance.effects.autoLite",
									"Using Lighter, because Linux renders these effects slowly.",
								)
							: t("settings.appearance.effects.autoFull", "Using Full.")}
					</Text>
				)}
			</Flex>
		</Card>
	);
};
