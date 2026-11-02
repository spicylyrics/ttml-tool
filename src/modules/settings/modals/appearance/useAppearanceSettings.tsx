import { useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	logoColorCustomAtom,
	logoColorPresetAtom,
} from "$/modules/logo-color/states";
import {
	accentColorAtom,
	advActiveLineBgAtom,
	advAudioBarBgAtom,
	advAudioBarTextAtom,
	advancedPrimaryTextColorAtom,
	advancedSecondaryTextColorAtom,
	advancedWaveformColorAtom,
	advancedWaveformProgressColorAtom,
	advChipBorderRadiusAtom,
	advChipGapAtom,
	advChipPaddingHorizontalAtom,
	advChipPaddingVerticalAtom,
	advDialogBgAtom,
	advDialogBorderAtom,
	advEditorBgAtom,
	advGeniusHeaderColorAtom,
	advGlobalBorderRadiusAtom,
	advGlobalBorderWidthAtom,
	advLineHoverBgAtom,
	advMenuHoverBgAtom,
	advRomanizationColorAtom,
	advScrollbarColorAtom,
	advSelectionColorAtom,
	advShadowIntensityAtom,
	advSidebarActiveAtom,
	advSidebarBgAtom,
	advTitlebarBgAtom,
	advTranslationColorAtom,
	appearanceEditorModeAtom,
	appearancePresetsAtom,
	appFontAtom,
	appFontStyleAtom,
	appFontWeightAtom,
	appLayoutOrderAtom,
	backgroundModeAtom,
	customAccentColorAtom,
	customFontDataAtom,
	customFontNameAtom,
	customGradientAngleAtom,
	customGradientCenterAtom,
	customGradientColorsAtom,
	customGradientOpacityAtom,
	customGradientSizeAtom,
	customGradientTypeAtom,
	glassmorphismBlurAtom,
	interfaceScaleAtom,
	legacyDarkThemeAtom,
	legacySpaceLabelsAtom,
	selectedGradientAtom,
	spicyLyricsDesignAtom,
	useCustomAccentAtom,
	useCustomGradientAtom,
} from "$/modules/settings/states/index.ts";
import { fontSelectionDialogAtom } from "$/states/dialogs.ts";
import { isDarkThemeAtom } from "$/states/main.ts";
import { generateRadixScale } from "$/utils/colorScale";
import {
	customBackgroundBlurAtom,
	customBackgroundBrightnessAtom,
	customBackgroundImageAtom,
	customBackgroundImageKeyAtom,
	customBackgroundMaskAtom,
	customBackgroundOpacityAtom,
} from "../customBackground";
export function useAppearanceSettings() {
	const [accentColor, setAccentColor] = useAtom(accentColorAtom);
	const [useCustomAccent, setUseCustomAccent] = useAtom(useCustomAccentAtom);
	const [customAccentColor, setCustomAccentColor] = useAtom(
		customAccentColorAtom,
	);
	const [spicyLyricsDesign, setSpicyLyricsDesign] = useAtom(
		spicyLyricsDesignAtom,
	);
	const [logoColorPreset, setLogoColorPreset] = useAtom(logoColorPresetAtom);
	const [logoColorCustom, setLogoColorCustom] = useAtom(logoColorCustomAtom);
	// The Spicy Lyrics design is dark-only, so preview the dark scale under it.
	const isDarkTheme = useAtomValue(isDarkThemeAtom) || spicyLyricsDesign;
	const customScale = useMemo(
		() => generateRadixScale(customAccentColor, isDarkTheme),
		[customAccentColor, isDarkTheme],
	);
	const [backgroundMode, setBackgroundMode] = useAtom(backgroundModeAtom);
	const [selectedGradient, setSelectedGradient] = useAtom(selectedGradientAtom);
	const [useCustomGradient, setUseCustomGradient] = useAtom(
		useCustomGradientAtom,
	);
	const [customGradientColors, setCustomGradientColors] = useAtom(
		customGradientColorsAtom,
	);
	const [customGradientType, setCustomGradientType] = useAtom(
		customGradientTypeAtom,
	);
	const [customGradientOpacity, setCustomGradientOpacity] = useAtom(
		customGradientOpacityAtom,
	);
	const [customGradientCenter, setCustomGradientCenter] = useAtom(
		customGradientCenterAtom,
	);
	const [customGradientAngle, setCustomGradientAngle] = useAtom(
		customGradientAngleAtom,
	);
	const [customGradientSize, setCustomGradientSize] = useAtom(
		customGradientSizeAtom,
	);
	const [editorMode, setEditorMode] = useAtom(appearanceEditorModeAtom);
	const [legacyDarkTheme, setLegacyDarkTheme] = useAtom(legacyDarkThemeAtom);
	const [advWaveformColor, setAdvWaveformColor] = useAtom(
		advancedWaveformColorAtom,
	);
	const [advWaveformProgress, setAdvWaveformProgress] = useAtom(
		advancedWaveformProgressColorAtom,
	);
	const [advPrimaryText, setAdvPrimaryText] = useAtom(
		advancedPrimaryTextColorAtom,
	);
	const [advSecondaryText, setAdvSecondaryText] = useAtom(
		advancedSecondaryTextColorAtom,
	);
	const [vTitlebarBg, setVTitlebarBg] = useAtom(advTitlebarBgAtom);
	const [vSidebarBg, setVSidebarBg] = useAtom(advSidebarBgAtom);
	const [vSidebarActive, setVSidebarActive] = useAtom(advSidebarActiveAtom);
	const [vMenuHover, setVMenuHover] = useAtom(advMenuHoverBgAtom);
	const [vEditorBg, setVEditorBg] = useAtom(advEditorBgAtom);
	const [vActiveLine, setVActiveLine] = useAtom(advActiveLineBgAtom);
	const [vLineHover, setVLineHover] = useAtom(advLineHoverBgAtom);
	const [vChipRadius, setVChipRadius] = useAtom(advChipBorderRadiusAtom);
	const [vChipGap, setVChipGap] = useAtom(advChipGapAtom);
	const [vChipPaddingV, setVChipPaddingV] = useAtom(advChipPaddingVerticalAtom);
	const [vChipPaddingH, setVChipPaddingH] = useAtom(
		advChipPaddingHorizontalAtom,
	);
	const [legacySpaceLabels, setLegacySpaceLabels] = useAtom(
		legacySpaceLabelsAtom,
	);
	const [vRomanColor, setVRomanColor] = useAtom(advRomanizationColorAtom);
	const [vTransColor, setVTransColor] = useAtom(advTranslationColorAtom);
	const [vGeniusHeaderColor, setVGeniusHeaderColor] = useAtom(
		advGeniusHeaderColorAtom,
	);
	const [vAudioBarBg, setVAudioBarBg] = useAtom(advAudioBarBgAtom);
	const [vAudioBarText, setVAudioBarText] = useAtom(advAudioBarTextAtom);
	const [vScrollbar, setVScrollbar] = useAtom(advScrollbarColorAtom);
	const [vDialogBg, setVDialogBg] = useAtom(advDialogBgAtom);
	const [vDialogBorder, setVDialogBorder] = useAtom(advDialogBorderAtom);
	const [vGlobalRadius, setVGlobalRadius] = useAtom(advGlobalBorderRadiusAtom);
	const [vGlobalBorderWidth, setVGlobalBorderWidth] = useAtom(
		advGlobalBorderWidthAtom,
	);
	const [vShadow, setVShadow] = useAtom(advShadowIntensityAtom);
	const [vSelection, setVSelection] = useAtom(advSelectionColorAtom);
	const [presets, setPresets] = useAtom(appearancePresetsAtom);
	const [layoutOrder, setLayoutOrder] = useAtom(appLayoutOrderAtom);
	const [newPresetName, setNewPresetName] = useState("");
	const [appFont, setAppFont] = useAtom(appFontAtom);
	const [appFontWeight, setAppFontWeight] = useAtom(appFontWeightAtom);
	const [appFontStyle, setAppFontStyle] = useAtom(appFontStyleAtom);
	const [customFontName, setCustomFontName] = useAtom(customFontNameAtom);
	const [customFontData, setCustomFontData] = useAtom(customFontDataAtom);
	const [customBackgroundOpacity, setCustomBackgroundOpacity] = useAtom(
		customBackgroundOpacityAtom,
	);
	const [customBackgroundMask, setCustomBackgroundMask] = useAtom(
		customBackgroundMaskAtom,
	);
	const [customBackgroundBlur, setCustomBackgroundBlur] = useAtom(
		customBackgroundBlurAtom,
	);
	const [customBackgroundBrightness, setCustomBackgroundBrightness] = useAtom(
		customBackgroundBrightnessAtom,
	);
	const customBackgroundImageKey = useAtomValue(customBackgroundImageKeyAtom);
	const setCustomBackgroundImage = useSetAtom(customBackgroundImageAtom);
	const [glassBlur, setGlassBlur] = useAtom(glassmorphismBlurAtom);
	const [interfaceScale, setInterfaceScale] = useAtom(interfaceScaleAtom);
	const [interfaceScaleDraft, setInterfaceScaleDraft] =
		useState(interfaceScale);
	useEffect(() => {
		setInterfaceScaleDraft(interfaceScale);
	}, [interfaceScale]);
	const [lastLoaded, setLastLoaded] = useState<string | null>(null);
	const setIsFontSelectionOpen = useSetAtom(fontSelectionDialogAtom);
	const [showBackgroundSettings, setShowBackgroundSettings] = useState(false);
	const { t } = useTranslation();
	return {
		accentColor,
		setAccentColor,
		useCustomAccent,
		setUseCustomAccent,
		customAccentColor,
		setCustomAccentColor,
		isDarkTheme,
		customScale,
		backgroundMode,
		setBackgroundMode,
		selectedGradient,
		setSelectedGradient,
		useCustomGradient,
		setUseCustomGradient,
		customGradientColors,
		setCustomGradientColors,
		customGradientType,
		setCustomGradientType,
		customGradientOpacity,
		setCustomGradientOpacity,
		customGradientCenter,
		setCustomGradientCenter,
		customGradientAngle,
		setCustomGradientAngle,
		customGradientSize,
		setCustomGradientSize,
		editorMode,
		setEditorMode,
		legacyDarkTheme,
		setLegacyDarkTheme,
		spicyLyricsDesign,
		setSpicyLyricsDesign,
		logoColorPreset,
		setLogoColorPreset,
		logoColorCustom,
		setLogoColorCustom,
		advWaveformColor,
		setAdvWaveformColor,
		advWaveformProgress,
		setAdvWaveformProgress,
		advPrimaryText,
		setAdvPrimaryText,
		advSecondaryText,
		setAdvSecondaryText,
		vTitlebarBg,
		setVTitlebarBg,
		vSidebarBg,
		setVSidebarBg,
		vSidebarActive,
		setVSidebarActive,
		vMenuHover,
		setVMenuHover,
		vEditorBg,
		setVEditorBg,
		vActiveLine,
		setVActiveLine,
		vLineHover,
		setVLineHover,
		vChipRadius,
		setVChipRadius,
		vChipGap,
		setVChipGap,
		vChipPaddingV,
		setVChipPaddingV,
		vChipPaddingH,
		setVChipPaddingH,
		legacySpaceLabels,
		setLegacySpaceLabels,
		vRomanColor,
		setVRomanColor,
		vTransColor,
		setVTransColor,
		vGeniusHeaderColor,
		setVGeniusHeaderColor,
		vAudioBarBg,
		setVAudioBarBg,
		vAudioBarText,
		setVAudioBarText,
		vScrollbar,
		setVScrollbar,
		vDialogBg,
		setVDialogBg,
		vDialogBorder,
		setVDialogBorder,
		vGlobalRadius,
		setVGlobalRadius,
		vGlobalBorderWidth,
		setVGlobalBorderWidth,
		vShadow,
		setVShadow,
		vSelection,
		setVSelection,
		presets,
		setPresets,
		layoutOrder,
		setLayoutOrder,
		newPresetName,
		setNewPresetName,
		appFont,
		setAppFont,
		appFontWeight,
		setAppFontWeight,
		appFontStyle,
		setAppFontStyle,
		customFontName,
		setCustomFontName,
		customFontData,
		setCustomFontData,
		customBackgroundOpacity,
		setCustomBackgroundOpacity,
		customBackgroundMask,
		setCustomBackgroundMask,
		customBackgroundBlur,
		setCustomBackgroundBlur,
		customBackgroundBrightness,
		setCustomBackgroundBrightness,
		customBackgroundImageKey,
		setCustomBackgroundImage,
		glassBlur,
		setGlassBlur,
		interfaceScale,
		setInterfaceScale,
		interfaceScaleDraft,
		setInterfaceScaleDraft,
		lastLoaded,
		setLastLoaded,
		setIsFontSelectionOpen,
		showBackgroundSettings,
		setShowBackgroundSettings,
		t,
	};
}
export type AppearanceSettings = ReturnType<typeof useAppearanceSettings>;
