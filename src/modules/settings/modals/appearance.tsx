import { Flex } from "@radix-ui/themes";
import { LogoColorSection } from "$/modules/logo-color/LogoColorSection";
import { AppearanceEditorMode } from "$/modules/settings/states/index.ts";
import { AppearanceEditorModeSection } from "./appearance/AppearanceEditorModeSection";
import { BackgroundSection } from "./appearance/BackgroundSection";
import { EditorLayoutSection } from "./appearance/EditorLayoutSection";
import { EffectsSection } from "./appearance/EffectsSection";
import { FontSection } from "./appearance/FontSection";
import { GlassSection } from "./appearance/GlassSection";
import { GlobalDesignSection } from "./appearance/GlobalDesignSection";
import { InterfaceScaleSection } from "./appearance/InterfaceScaleSection";
import { LayoutSection } from "./appearance/LayoutSection";
import { PlaybackVisualsSection } from "./appearance/PlaybackVisualsSection";
import { PresetsSection } from "./appearance/PresetsSection";
import { ProjectColorsSection } from "./appearance/ProjectColorsSection";
import { createPresetActions } from "./appearance/presetActions";
import { ResetAdvancedSection } from "./appearance/ResetAdvancedSection";
import { ResetThemeSection } from "./appearance/ResetThemeSection";
import { SpicyLyricsDesignSection } from "./appearance/SpicyLyricsDesignSection";
import { ThemeSection } from "./appearance/ThemeSection";
import { useAppearanceSettings } from "./appearance/useAppearanceSettings";
import { WorkspaceSection } from "./appearance/WorkspaceSection";
import { SettingsCustomBackgroundSettings } from "./customBackground";
export const SettingsAppearanceTab = () => {
	const settings = useAppearanceSettings();
	const state = { ...settings, ...createPresetActions(settings) };
	const { showBackgroundSettings, setShowBackgroundSettings, editorMode } =
		state;
	if (showBackgroundSettings) {
		return (
			<SettingsCustomBackgroundSettings
				onClose={() => setShowBackgroundSettings(false)}
			/>
		);
	}

	return (
		<Flex direction="column" gap="4">
			<SpicyLyricsDesignSection {...state} />
			<EffectsSection {...state} />
			<LogoColorSection />
			<AppearanceEditorModeSection {...state} />

			<PresetsSection {...state} />

			<GlassSection {...state} />

			{editorMode === AppearanceEditorMode.Basic ? (
				<>
					<ThemeSection {...state} />

					<BackgroundSection {...state} />
					<InterfaceScaleSection {...state} />

					<FontSection {...state} />

					<ResetThemeSection {...state} />
				</>
			) : (
				<Flex direction="column" gap="4">
					<ProjectColorsSection {...state} />

					<WorkspaceSection {...state} />

					<EditorLayoutSection {...state} />

					<PlaybackVisualsSection {...state} />

					<GlobalDesignSection {...state} />

					<LayoutSection {...state} />

					<ResetAdvancedSection {...state} />
				</Flex>
			)}
		</Flex>
	);
};
