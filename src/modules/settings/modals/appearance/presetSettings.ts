import type { AppearancePreset } from "$/modules/settings/states";
import type { AppearanceSettings } from "./useAppearanceSettings";
export type PresetSnapshotInput = Pick<
	AppearanceSettings,
	| "accentColor"
	| "useCustomAccent"
	| "customAccentColor"
	| "glassBlur"
	| "appFont"
	| "interfaceScale"
	| "customBackgroundImageKey"
	| "appFontWeight"
	| "appFontStyle"
	| "customFontName"
	| "customFontData"
	| "customBackgroundOpacity"
	| "customBackgroundMask"
	| "customBackgroundBlur"
	| "customBackgroundBrightness"
	| "backgroundMode"
	| "selectedGradient"
	| "useCustomGradient"
	| "customGradientColors"
	| "customGradientType"
	| "customGradientOpacity"
	| "customGradientCenter"
	| "customGradientAngle"
	| "customGradientSize"
	| "advWaveformColor"
	| "advWaveformProgress"
	| "advPrimaryText"
	| "advSecondaryText"
	| "vTitlebarBg"
	| "vSidebarBg"
	| "vSidebarActive"
	| "vMenuHover"
	| "vEditorBg"
	| "vActiveLine"
	| "vLineHover"
	| "vSelection"
	| "vChipRadius"
	| "vChipGap"
	| "vChipPaddingV"
	| "vChipPaddingH"
	| "vRomanColor"
	| "vTransColor"
	| "vGeniusHeaderColor"
	| "vAudioBarBg"
	| "vAudioBarText"
	| "vScrollbar"
	| "vDialogBg"
	| "vDialogBorder"
	| "vGlobalRadius"
	| "vGlobalBorderWidth"
	| "vShadow"
	| "layoutOrder"
	| "legacyDarkTheme"
	| "legacySpaceLabels"
	| "spicyLyricsDesign"
	| "logoColorPreset"
	| "logoColorCustom"
>;
export function capturePresetSettings({
	accentColor,
	useCustomAccent,
	customAccentColor,
	glassBlur,
	appFont,
	interfaceScale,
	customBackgroundImageKey,
	appFontWeight,
	appFontStyle,
	customFontName,
	customFontData,
	customBackgroundOpacity,
	customBackgroundMask,
	customBackgroundBlur,
	customBackgroundBrightness,
	backgroundMode,
	selectedGradient,
	useCustomGradient,
	customGradientColors,
	customGradientType,
	customGradientOpacity,
	customGradientCenter,
	customGradientAngle,
	customGradientSize,
	advWaveformColor,
	advWaveformProgress,
	advPrimaryText,
	advSecondaryText,
	vTitlebarBg,
	vSidebarBg,
	vSidebarActive,
	vMenuHover,
	vEditorBg,
	vActiveLine,
	vLineHover,
	vSelection,
	vChipRadius,
	vChipGap,
	vChipPaddingV,
	vChipPaddingH,
	vRomanColor,
	vTransColor,
	vGeniusHeaderColor,
	vAudioBarBg,
	vAudioBarText,
	vScrollbar,
	vDialogBg,
	vDialogBorder,
	vGlobalRadius,
	vGlobalBorderWidth,
	vShadow,
	layoutOrder,
	legacyDarkTheme,
	legacySpaceLabels,
	spicyLyricsDesign,
	logoColorPreset,
	logoColorCustom,
}: PresetSnapshotInput): AppearancePreset["settings"] {
	return {
		// Basic & General
		accentColor,
		useCustomAccent,
		customAccentColor,
		glassBlur,
		appFont,
		interfaceScale,
		customBackgroundImageKey,
		appFontWeight,
		appFontStyle,
		customFontName,
		customFontData,
		customBackgroundOpacity,
		customBackgroundMask,
		customBackgroundBlur,
		customBackgroundBrightness,

		// Backgrounds
		backgroundMode,
		selectedGradient,
		useCustomGradient,
		customGradientColors,
		customGradientType,
		customGradientOpacity,
		customGradientCenter,
		customGradientAngle,
		customGradientSize,
		// Advanced
		advWaveformColor,
		advWaveformProgress,
		advPrimaryText,
		advSecondaryText,
		vTitlebarBg,
		vSidebarBg,
		vSidebarActive,
		vMenuHover,
		vEditorBg,
		vActiveLine,
		vLineHover,
		vSelection,
		vChipRadius,
		vChipGap,
		vChipPaddingV,
		vChipPaddingH,
		vRomanColor,
		vTransColor,
		vGeniusHeaderColor,
		vAudioBarBg,
		vAudioBarText,
		vScrollbar,
		vDialogBg,
		vDialogBorder,
		vGlobalRadius,
		vGlobalBorderWidth,
		vShadow,
		layoutOrder,
		legacyDarkTheme,
		legacySpaceLabels,
		spicyLyricsDesign,
		logoColorPreset,
		logoColorCustom,
	};
}
