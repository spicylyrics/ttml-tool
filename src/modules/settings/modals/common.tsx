import { Flex } from "@radix-ui/themes";
import { ReferenceSidebarSetting } from "$/modules/reference-sidebar/ReferenceSidebarSetting";
import { AutosaveSection } from "./common/AutosaveSection";
import { DisplaySection } from "./common/DisplaySection";
import { ImportCleanupSection } from "./common/ImportCleanupSection";
import { PlaybackBehaviorSection } from "./common/PlaybackBehaviorSection";
import { PlaybackSection } from "./common/PlaybackSection";
import { PrivacySection } from "./common/PrivacySection";
import { ProjectsSection } from "./common/ProjectsSection";
import { SyncingSection } from "./common/SyncingSection";
import { useCommonSettings } from "./common/useCommonSettings";
import { WorkflowSettings } from "./workflow";
export type CommonSettingsSection = "general" | "editor" | "files" | "audio";
export const SettingsCommonTab = ({
	section = "general",
}: {
	section?: CommonSettingsSection;
}) => {
	const state = useCommonSettings();
	return (
		<Flex direction="column" gap="4">
			{section === "general" && <DisplaySection {...state} />}

			{section === "editor" && <SyncingSection {...state} />}

			{section === "editor" && <PlaybackBehaviorSection {...state} />}

			{section === "editor" && <WorkflowSettings />}

			{section === "editor" && <ReferenceSidebarSetting />}

			{section === "general" && import.meta.env.TAURI_ENV_PLATFORM && (
				<PrivacySection {...state} />
			)}

			{section === "files" && <ImportCleanupSection {...state} />}

			{section === "files" && <ProjectsSection {...state} />}

			{section === "audio" && <PlaybackSection {...state} />}

			{section === "files" && <AutosaveSection {...state} />}
		</Flex>
	);
};
