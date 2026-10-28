import { Flex, Heading, Text } from "@radix-ui/themes";
import { ChangelogScreenSetting } from "$/modules/changelog/ChangelogScreenSetting";
import { CommunitySection } from "./about/CommunitySection";
import { CreditsSection } from "./about/CreditsSection";
import { MaintainersSection } from "./about/MaintainersSection";
import { UpdateSection } from "./about/UpdateSection";
import { useAboutSettings } from "./about/useAboutSettings";
import { VersionSection } from "./about/VersionSection";
import { WebsiteRecoverySection } from "./about/WebsiteRecoverySection";
export const SettingsAboutTab = () => {
	const state = useAboutSettings();
	return (
		<Flex direction="column" gap="4">
			<Flex direction="column" gap="1">
				<Heading size="4">
					{state.t("aboutModal.appName", "Spicy Lyrics TTML Tool")}
				</Heading>
				<Text as="div" size="2" color="gray">
					{state.t(
						"aboutModal.description",
						"A word-by-word TTML editor and timing tool for Apple Music-like lyrics",
					)}
				</Text>
			</Flex>

			<MaintainersSection {...state} />

			<CreditsSection {...state} />

			<CommunitySection {...state} />

			<WebsiteRecoverySection {...state} />

			<VersionSection {...state} />

			<UpdateSection {...state} />

			<ChangelogScreenSetting />
		</Flex>
	);
};
