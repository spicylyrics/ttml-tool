import { Flex } from "@radix-ui/themes";
import { AboutHeader } from "./about/AboutHeader";
import { CommunitySection } from "./about/CommunitySection";
import { CreditsSection } from "./about/CreditsSection";
import { MaintainersSection } from "./about/MaintainersSection";
import { UpdateSection } from "./about/UpdateSection";
import { useAboutSettings } from "./about/useAboutSettings";
import { VersionSection } from "./about/VersionSection";
import { WebsiteRecoverySection } from "./about/WebsiteRecoverySection";

// Version and updates first, since that's what people open About for. Build
// details and website fixes stay at the bottom for bug reports.
export const SettingsAboutTab = () => {
	const state = useAboutSettings();
	return (
		<Flex direction="column" gap="4">
			<AboutHeader {...state} />

			<UpdateSection {...state} />

			<MaintainersSection {...state} />

			<CreditsSection {...state} />

			<CommunitySection {...state} />

			<VersionSection {...state} />

			<WebsiteRecoverySection {...state} />
		</Flex>
	);
};
