import { Flex, Text } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import { OptionPicker } from "$/components/OptionPicker";
import { SettingToggle } from "$/modules/settings/components/WorkflowControls";
import {
	type FollowStyle,
	spectrogramFollowFeatureAtom,
	spectrogramFollowStyleAtom,
} from "../states/follow-playhead";

/** Preferences block: the feature flag and the follow style. */
export function FollowPlayheadSettings() {
	const { t } = useTranslation();
	const featureEnabled = useAtomValue(spectrogramFollowFeatureAtom);
	const [style, setStyle] = useAtom(spectrogramFollowStyleAtom);

	return (
		<Flex direction="column" gap="2">
			<Text as="label">
				<Flex gap="3" align="center" justify="between">
					<Flex direction="column" gap="1">
						<Text>{t("spectrogramFollow.setting", "Follow the playhead")}</Text>
						<Text size="1" color="gray">
							{t(
								"spectrogramFollow.settingDesc",
								"Scrolls the spectrogram to keep the playhead in view. Scrolling or dragging pauses it until you press play or leave it for a moment. Adds a toggle to the spectrogram toolbar.",
							)}
						</Text>
					</Flex>
					<SettingToggle setting={spectrogramFollowFeatureAtom} />
				</Flex>
			</Text>
			{featureEnabled && (
				<OptionPicker<FollowStyle>
					variant="segmented"
					size="2"
					value={style}
					onValueChange={setStyle}
					label={t("spectrogramFollow.style", "Follow style")}
					options={[
						{
							value: "page",
							label: t("spectrogramFollow.page", "Page"),
						},
						{
							value: "continuous",
							label: t("spectrogramFollow.continuous", "Continuous"),
						},
					]}
				/>
			)}
			{featureEnabled && (
				<Text size="1" color="gray">
					{style === "page"
						? t(
								"spectrogramFollow.pageDesc",
								"Jumps ahead when the playhead leaves the view.",
							)
						: t(
								"spectrogramFollow.continuousDesc",
								"Scrolls with the playhead and keeps it centered.",
							)}
				</Text>
			)}
		</Flex>
	);
}
