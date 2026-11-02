import { toast } from "react-toastify";
import type { LogoColorPreset } from "$/modules/logo-color/presets";
import { applyDefinedPresetSettings } from "$/modules/settings/logic/appearance-presets";
import { getPresetGlassBlur } from "$/modules/settings/logic/glass-blur";
import type { AppearancePreset } from "$/modules/settings/states/index.ts";
import { capturePresetSettings } from "./presetSettings";
import type { AppearanceSettings } from "./useAppearanceSettings";
export function createPresetActions({
	accentColor,
	setAccentColor,
	useCustomAccent,
	setUseCustomAccent,
	customAccentColor,
	setCustomAccentColor,
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
	legacyDarkTheme,
	setLegacyDarkTheme,
	legacySpaceLabels,
	setLegacySpaceLabels,
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
	setLastLoaded,
	t,
}: AppearanceSettings) {
	const handleSavePreset = () => {
		if (!newPresetName.trim()) return;
		const newPreset: AppearancePreset = {
			id: Date.now().toString(),
			name: newPresetName,
			settings: capturePresetSettings({
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
			}),
		};
		setPresets([...presets, newPreset]);
		setNewPresetName("");
	};
	const handleLoadPreset = async (p: AppearancePreset) => {
		const s = p.settings;
		if (s.customBackgroundImageKey !== undefined) {
			const loaded = await setCustomBackgroundImage(s.customBackgroundImageKey);
			if (!loaded)
				toast.warning(
					t(
						"settings.appearance.presets.missingBackground",
						"This preset's background image is unavailable on this device. The current image was kept.",
					),
				);
		}
		applyDefinedPresetSettings(s, {
			appFont: setAppFont,
			interfaceScale: setInterfaceScale,
			appFontWeight: setAppFontWeight,
			appFontStyle: setAppFontStyle,
			customFontName: setCustomFontName,
			customFontData: setCustomFontData,
			customBackgroundOpacity: setCustomBackgroundOpacity,
			customBackgroundMask: setCustomBackgroundMask,
			customBackgroundBlur: setCustomBackgroundBlur,
			customBackgroundBrightness: setCustomBackgroundBrightness,
		});

		// Set a small loading indicator state
		setLastLoaded(p.name);

		// Basic & General
		if (s.accentColor !== undefined) setAccentColor(s.accentColor);
		if (s.useCustomAccent !== undefined)
			setUseCustomAccent(!!s.useCustomAccent);
		if (s.customAccentColor !== undefined)
			setCustomAccentColor(s.customAccentColor);
		const presetBlur = getPresetGlassBlur(s);
		if (presetBlur !== undefined) setGlassBlur(presetBlur);

		// Backgrounds
		if (s.backgroundMode !== undefined) setBackgroundMode(s.backgroundMode);
		if (s.selectedGradient !== undefined)
			setSelectedGradient(s.selectedGradient);
		if (s.useCustomGradient !== undefined)
			setUseCustomGradient(!!s.useCustomGradient);
		if (s.customGradientColors !== undefined)
			setCustomGradientColors(s.customGradientColors);
		if (s.customGradientType !== undefined)
			setCustomGradientType(s.customGradientType);
		if (s.customGradientOpacity !== undefined)
			setCustomGradientOpacity(Number(s.customGradientOpacity));
		if (s.customGradientCenter !== undefined)
			setCustomGradientCenter(s.customGradientCenter);
		if (s.customGradientAngle !== undefined)
			setCustomGradientAngle(Number(s.customGradientAngle));
		if (s.customGradientSize !== undefined)
			setCustomGradientSize(Number(s.customGradientSize));
		if (s.legacyDarkTheme !== undefined)
			setLegacyDarkTheme(!!s.legacyDarkTheme);
		if (s.legacySpaceLabels !== undefined)
			setLegacySpaceLabels(!!s.legacySpaceLabels);
		if (s.spicyLyricsDesign !== undefined)
			setSpicyLyricsDesign(!!s.spicyLyricsDesign);
		// resolveLogoColor treats anything unknown as Default, so a stale or
		// hand-edited preset can't inject a color.
		if (s.logoColorPreset !== undefined)
			setLogoColorPreset(s.logoColorPreset as LogoColorPreset);
		if (s.logoColorCustom !== undefined) setLogoColorCustom(s.logoColorCustom);

		// Advanced
		if (s.advWaveformColor !== undefined)
			setAdvWaveformColor(s.advWaveformColor);
		if (s.advWaveformProgress !== undefined)
			setAdvWaveformProgress(s.advWaveformProgress);
		if (s.advPrimaryText !== undefined) setAdvPrimaryText(s.advPrimaryText);
		if (s.advSecondaryText !== undefined)
			setAdvSecondaryText(s.advSecondaryText);
		if (s.vTitlebarBg !== undefined) setVTitlebarBg(s.vTitlebarBg);
		if (s.vSidebarBg !== undefined) setVSidebarBg(s.vSidebarBg);
		if (s.vSidebarActive !== undefined) setVSidebarActive(s.vSidebarActive);
		if (s.vMenuHover !== undefined) setVMenuHover(s.vMenuHover);
		if (s.vEditorBg !== undefined) setVEditorBg(s.vEditorBg);
		if (s.vActiveLine !== undefined) setVActiveLine(s.vActiveLine);
		if (s.vLineHover !== undefined) setVLineHover(s.vLineHover);
		if (s.vSelection !== undefined) setVSelection(s.vSelection);
		if (s.vChipRadius !== undefined) setVChipRadius(Number(s.vChipRadius));
		if (s.vChipGap !== undefined) setVChipGap(Number(s.vChipGap));
		if (s.vChipPaddingV !== undefined)
			setVChipPaddingV(Number(s.vChipPaddingV));
		if (s.vChipPaddingH !== undefined)
			setVChipPaddingH(Number(s.vChipPaddingH));
		if (s.vRomanColor !== undefined) setVRomanColor(s.vRomanColor);
		if (s.vTransColor !== undefined) setVTransColor(s.vTransColor);
		if (s.vGeniusHeaderColor !== undefined)
			setVGeniusHeaderColor(s.vGeniusHeaderColor);
		if (s.vAudioBarBg !== undefined) setVAudioBarBg(s.vAudioBarBg);
		if (s.vAudioBarText !== undefined) setVAudioBarText(s.vAudioBarText);
		if (s.vScrollbar !== undefined) setVScrollbar(s.vScrollbar);
		if (s.vDialogBg !== undefined) setVDialogBg(s.vDialogBg);
		if (s.vDialogBorder !== undefined) setVDialogBorder(s.vDialogBorder);
		if (s.vGlobalRadius !== undefined)
			setVGlobalRadius(Number(s.vGlobalRadius));
		if (s.vGlobalBorderWidth !== undefined)
			setVGlobalBorderWidth(Number(s.vGlobalBorderWidth));
		if (s.vShadow !== undefined) setVShadow(Number(s.vShadow));
		if (s.layoutOrder !== undefined) setLayoutOrder(s.layoutOrder);

		// Small timeout to clear the flash of "active" state if desired,
		// but keeping it visible helps user know it worked.
	};
	return { handleSavePreset, handleLoadPreset };
}
