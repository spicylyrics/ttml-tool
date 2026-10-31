import { describe, expect, it } from "vitest";
import {
	capturePresetSettings,
	type PresetSnapshotInput,
} from "./presetSettings";

const settings: PresetSnapshotInput = {
	accentColor: "red",
	useCustomAccent: false,
	customAccentColor: "#e5484d",
	glassBlur: 0,
	appFont: "Inter",
	interfaceScale: 1.25,
	customBackgroundImageKey: "image:older-background",
	appFontWeight: "700",
	appFontStyle: "italic",
	customFontName: null,
	customFontData: null,
	customBackgroundOpacity: 0,
	customBackgroundMask: 0.2,
	customBackgroundBlur: 0,
	customBackgroundBrightness: 1,
	backgroundMode: "gradient",
	selectedGradient: "sunset",
	useCustomGradient: true,
	customGradientColors: ["#7028e4", "#ffffff"],
	customGradientType: "radial",
	customGradientOpacity: 0,
	customGradientCenter: [25, 75],
	customGradientAngle: 45,
	customGradientSize: 2,
	advWaveformColor: "",
	advWaveformProgress: "#123456",
	advPrimaryText: "#ffffff",
	advSecondaryText: "#888888",
	vTitlebarBg: "",
	vSidebarBg: "#000000",
	vSidebarActive: "",
	vMenuHover: "",
	vEditorBg: "",
	vActiveLine: "",
	vLineHover: "",
	vSelection: "",
	vChipRadius: 8,
	vChipGap: 0,
	vChipPaddingV: 4,
	vChipPaddingH: 12,
	vRomanColor: "",
	vTransColor: "",
	vGeniusHeaderColor: "#abcdef",
	vAudioBarBg: "",
	vAudioBarText: "",
	vScrollbar: "",
	vDialogBg: "",
	vDialogBorder: "",
	vGlobalRadius: 12,
	vGlobalBorderWidth: 0,
	vShadow: 0,
	layoutOrder: ["titlebar", "ribbonbar", "editor", "audio-controls"],
	legacyDarkTheme: false,
	legacySpaceLabels: true,
	spicyLyricsDesign: false,
	logoColorPreset: "custom",
	logoColorCustom: "#12ab9f",
};

describe("appearance preset snapshots", () => {
	it("keeps all saved appearance fields, including zero, false, empty overrides and removed fonts", () => {
		const snapshot = capturePresetSettings(settings);
		expect(snapshot).toEqual(settings);
		expect(snapshot).not.toBe(settings);
		expect(snapshot.customGradientColors).toBe(settings.customGradientColors);
		expect(snapshot.customGradientCenter).toBe(settings.customGradientCenter);
		expect(snapshot.layoutOrder).toBe(settings.layoutOrder);
	});

	it("excludes dialog state and leaves the input unchanged", () => {
		const input = {
			...settings,
			newPresetName: "Theme Name",
			lastLoaded: "Another Theme",
		};
		const before = structuredClone(input);
		const snapshot = capturePresetSettings(input);
		expect(snapshot).toEqual(settings);
		expect(input).toEqual(before);
	});
});
