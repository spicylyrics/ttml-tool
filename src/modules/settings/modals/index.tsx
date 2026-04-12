import { Box, Dialog, Tabs } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { memo } from "react";
import { useTranslation } from "react-i18next";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs.ts";
import { SettingsAboutTab } from "./about";
import { SettingsAppearanceTab } from "./appearance";
import { SettingsAssistantTab } from "./assistant";
import { SettingsCommonTab } from "./common";
import { SettingsKeyBindingsDialog } from "./keybindings";
import { SettingsSpectrogramTab } from "./spectrogram";
import { AudioSettingsTab } from "./audio";

export const SettingsDialog = memo(() => {
	const [settingsDialogOpen, setSettingsDialogOpen] =
		useAtom(settingsDialogAtom);
	const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
	const { t } = useTranslation();

	return (
		<Dialog.Root open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
			<Dialog.Content maxWidth="600px">
				<Dialog.Title>{t("settingsDialog.title", "Preferences")}</Dialog.Title>
				<Tabs.Root value={activeTab} onValueChange={setActiveTab}>
					<Tabs.List>
						<Tabs.Trigger value="common">
							{t("settingsDialog.tab.common", "General")}
						</Tabs.Trigger>
						<Tabs.Trigger value="assistant">
							{t("settingsDialog.tab.assistant", "Assistant")}
						</Tabs.Trigger>
						<Tabs.Trigger value="appearance">
							{t("settingsDialog.tab.appearance", "Appearance")}
						</Tabs.Trigger>
						<Tabs.Trigger value="audio">
							{t("settingsDialog.tab.audio", "Audio")}
						</Tabs.Trigger>
						<Tabs.Trigger value="keybinding">
							{t("settingsDialog.tab.keybindings", "Keybindings")}
						</Tabs.Trigger>
						<Tabs.Trigger value="spectrogram">
							{t("settingsDialog.tab.spectrogram", "Spectrogram")}
						</Tabs.Trigger>
						<Tabs.Trigger value="about">
							{t("common.about", "About")}
						</Tabs.Trigger>
					</Tabs.List>
					<Box
						style={{
							height: "630px",
							overflowY: "auto",
							padding: "var(--space-3)",
							paddingBottom: "var(--space-4)",
						}}
					>
						<Tabs.Content value="common">
							{/* @ts-ignore */}
							<SettingsCommonTab />
						</Tabs.Content>
						<Tabs.Content value="assistant">
							<SettingsAssistantTab />
						</Tabs.Content>
						<Tabs.Content value="appearance">
							<SettingsAppearanceTab />
						</Tabs.Content>
						<Tabs.Content value="keybinding">
							<SettingsKeyBindingsDialog />
						</Tabs.Content>
						<Tabs.Content value="spectrogram">
							<SettingsSpectrogramTab />
						</Tabs.Content>
						<Tabs.Content value="audio">
							<AudioSettingsTab />
						</Tabs.Content>
						<Tabs.Content value="about">
							<SettingsAboutTab />
						</Tabs.Content>
					</Box>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
});
