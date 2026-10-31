import { atom, type ExtractAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { type EffectsMode, usesLiteEffects } from "../logic/effects-mode";
import { clampGlassBlur } from "../logic/glass-blur";
import { atomWithMigratedStorage } from "./migrated-storage";

export enum SyncJudgeMode {
	FirstKeyDownTime = "first-keydown-time",
	FirstKeyDownTimeLegacy = "first-keydown-time-legacy",
	LastKeyUpTime = "last-keyup-time",
	MiddleKeyTime = "middle-key-time",
}

export const geniusApiKeyAtom = atomWithStorage<string>("geniusApiKey", "");

export const latencyTestBPMAtom = atomWithStorage("latencyTestBPM", 120);

export const syncJudgeModeAtom = atomWithStorage(
	"syncJudgeMode",
	SyncJudgeMode.FirstKeyDownTime,
);

export const showWordRomanizationInputAtom = atomWithStorage(
	"showWordRomanizationInput",
	false,
);

export const displayRomanizationInSyncAtom = atomWithStorage(
	"displayRomanizationInSync",
	false,
);

export const showLineTranslationAtom = atomWithStorage(
	"showLineTranslation",
	true,
);

export const showLineRomanizationAtom = atomWithStorage(
	"showLineRomanization",
	true,
);

export const generateNameFromMetadataAtom = atomWithStorage(
	"generateNameFromMetadata",
	true,
);

export const autosaveEnabledAtom = atomWithStorage("autosaveEnabled", true);
export const autosaveIntervalAtom = atomWithStorage("autosaveInterval", 10);
export const autosaveLimitAtom = atomWithStorage("autosaveLimit", 10);
export const folderProjectsEnabledAtom = atomWithStorage(
	"folderProjectsEnabled",
	false,
);
export const folderProjectsAutosaveAtom = atomWithStorage(
	"folderProjectsAutosave",
	true,
);

export const discordRichPresenceEnabledAtom = atomWithStorage(
	"discordRichPresenceEnabled",
	false,
);
export const discordDetailsTemplateAtom = atomWithStorage(
	"discordDetailsTemplate",
	"{{mode}} {{title}}",
);
export const discordStateTemplateAtom = atomWithStorage(
	"discordStateTemplate",
	"[[{{artist}} • ]]{{lineProgress}} • {{playbackStatus}}",
);
export const discordPlaybackTimelineAtom = atomWithStorage(
	"discordPlaybackTimeline",
	true,
);
export const discordProjectElapsedAtom = atomWithStorage(
	"discordProjectElapsed",
	true,
);
export const discordRepositoryButtonAtom = atomWithStorage(
	"discordRepositoryButton",
	true,
);
export const discordStatusBadgeAtom = atomWithStorage(
	"discordStatusBadge",
	true,
);
export const discordIdleTimeoutMinutesAtom = atomWithStorage(
	"discordIdleTimeoutMinutes",
	5,
);

export const showTimestampsAtom = atomWithStorage("showTimestamps", true);
export const enableManualTimestampEditAtom = atomWithStorage(
	"enableManualTimestampEdit",
	false,
);

export const highlightActiveWordAtom = atomWithStorage(
	"highlightActiveWord",
	true,
);

export const enableSyncGlowAnimationAtom = atomWithStorage(
	"enableSyncGlowAnimation",
	false,
);

export const highlightErrorsAtom = atomWithStorage("highlightErrors", true);

export const smartLastWordAtom = atomWithStorage("smartLastWord", false);
export const compactBGInSyncAtom = atomWithStorage("compactBGInSync", true);

export const accentColorAtom = atomWithStorage<
	| "gray"
	| "gold"
	| "bronze"
	| "brown"
	| "yellow"
	| "amber"
	| "orange"
	| "tomato"
	| "red"
	| "crimson"
	| "pink"
	| "plum"
	| "purple"
	| "violet"
	| "iris"
	| "indigo"
	| "blue"
	| "cyan"
	| "teal"
	| "jade"
	| "green"
	| "grass"
	| "lime"
	| "mint"
	| "sky"
>("accentColor", "red");

export const backgroundModeAtom = atomWithStorage<
	"none" | "image" | "gradient"
>("backgroundMode", "none");

export const selectedGradientAtom = atomWithStorage<string>(
	"selectedGradient",
	"sunset",
);

export const useCustomAccentAtom = atomWithStorage<boolean>(
	"useCustomAccent",
	false,
);

export const customAccentColorAtom = atomWithStorage<string>(
	"customAccentColor",
	"#e5484d",
);

export const useCustomGradientAtom = atomWithStorage<boolean>(
	"useCustomGradient",
	false,
);

export const customGradientColorsAtom = atomWithStorage<string[]>(
	"customGradientColors",
	["#7028e4"],
);

export const customGradientTypeAtom = atomWithStorage<
	"linear" | "radial" | "conic"
>("customGradientType", "linear");

export const customGradientOpacityAtom = atomWithStorage<number>(
	"customGradientOpacity",
	1,
);

export const customGradientCenterAtom = atomWithStorage<[number, number]>(
	"customGradientCenter",
	[50, 50],
);

export const customGradientAngleAtom = atomWithStorage<number>(
	"customGradientAngle",
	45,
);

export const customGradientSizeAtom = atomWithStorage<number>(
	"customGradientSize",
	1,
);

export const DEFAULT_APP_FONT =
	'"MiSans", Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const appFontAtom = atomWithStorage<string>("appFont", DEFAULT_APP_FONT);

// Geist has no CJK glyphs, so Japanese, Chinese and Korean lyrics fall through
// to MiSans and the system CJK faces.
export const SPICY_LYRICS_FONT_STACK =
	'"Geist Variable", "MiSans", system-ui, -apple-system, "Segoe UI", "Hiragino Sans", "Yu Gothic UI", "Microsoft YaHei UI", "PingFang SC", "Malgun Gothic", sans-serif';

export const customFontDataAtom = atomWithStorage<string | null>(
	"customFontData",
	null,
);
export const customFontNameAtom = atomWithStorage<string | null>(
	"customFontName",
	null,
);

export const appFontWeightAtom = atomWithStorage<string>(
	"appFontWeight",
	"400",
);
export const appFontStyleAtom = atomWithStorage<string>(
	"appFontStyle",
	"normal",
);

export const normalizeApostrophesOnImportAtom = atomWithStorage<boolean>(
	"normalizeApostrophesOnImport",
	true,
);

export const normalizeCyrillicEsOnImportAtom = atomWithStorage<boolean>(
	"normalizeCyrillicEsOnImport",
	false,
);

export const allowConsecutiveBackgroundLinesAtom = atomWithStorage<boolean>(
	"allowConsecutiveBackgroundLines",
	false,
	undefined,
	{ getOnInit: true },
);

export const lyricTextNormalizationOptionsAtom = atom((get) => ({
	normalizeApostrophes: get(normalizeApostrophesOnImportAtom),
	normalizeCyrillicEs: get(normalizeCyrillicEsOnImportAtom),
}));

export const glassmorphismBlurAtom = atomWithMigratedStorage<number>(
	"glassmorphismBlur",
	24,
	{
		legacyKey: "advBackdropBlur",
		obsoleteKeys: ["advBackdropBlur"],
		normalize: clampGlassBlur,
	},
);

export const interfaceScaleAtom = atomWithStorage<number>(
	"interfaceScale",
	1,
	undefined,
	{ getOnInit: true },
);

export enum AppearanceEditorMode {
	Basic = "basic",
	Advanced = "advanced",
}

export const appearanceEditorModeAtom = atomWithStorage<AppearanceEditorMode>(
	"appearanceEditorMode",
	AppearanceEditorMode.Basic,
);

export const legacyDarkThemeAtom = atomWithStorage<boolean>(
	"legacyDarkTheme",
	false,
);

// Read on init so people who turned it off don't see the new design flash in.
export const spicyLyricsDesignAtom = atomWithStorage<boolean>(
	"spicyLyricsDesign",
	true,
	undefined,
	{ getOnInit: true },
);

// Read on init so the first paint already skips the expensive effects.
export const effectsModeAtom = atomWithStorage<EffectsMode>(
	"effectsMode",
	"auto",
	undefined,
	{ getOnInit: true },
);

export const liteEffectsAtom = atom((get) =>
	usesLiteEffects(get(effectsModeAtom), import.meta.env.TAURI_ENV_PLATFORM),
);

export const advancedWaveformColorAtom = atomWithStorage<string>(
	"advancedWaveformColor",
	"",
);

export const advancedWaveformProgressColorAtom = atomWithStorage<string>(
	"advancedWaveformProgressColor",
	"",
);

export const advancedPrimaryTextColorAtom = atomWithStorage<string>(
	"advancedPrimaryTextColor",
	"",
);

export const advancedSecondaryTextColorAtom = atomWithStorage<string>(
	"advancedSecondaryTextColor",
	"",
);

// --- 20+ Advanced Workspace Customizations ---
export const advTitlebarBgAtom = atomWithStorage("advTitlebarBg", "");
export const advSidebarBgAtom = atomWithStorage("advSidebarBg", "");
export const advSidebarActiveAtom = atomWithStorage("advSidebarActive", "");
export const advMenuHoverBgAtom = atomWithStorage("advMenuHoverBg", "");

export const advEditorBgAtom = atomWithStorage("advEditorBg", "");
export const advActiveLineBgAtom = atomWithStorage("advActiveLineBg", "");
export const advLineHoverBgAtom = atomWithStorage("advLineHoverBg", "");

export const advChipBorderRadiusAtom = atomWithStorage(
	"advChipBorderRadius",
	8,
);
export const advChipGapAtom = atomWithStorage("advChipGap", 8);
export const advChipPaddingVerticalAtom = atomWithStorage(
	"advChipPaddingVertical",
	2,
);
export const advChipPaddingHorizontalAtom = atomWithStorage(
	"advChipPaddingHorizontal",
	8,
);
export const legacySpaceLabelsAtom = atomWithStorage(
	"legacySpaceLabels",
	false,
);

export const advRomanizationColorAtom = atomWithStorage(
	"advRomanizationColor",
	"",
);
export const advTranslationColorAtom = atomWithStorage(
	"advTranslationColor",
	"",
);
export const advGeniusHeaderColorAtom = atomWithStorage(
	"advGeniusHeaderColor",
	"",
);

export const advAudioBarBgAtom = atomWithStorage("advAudioBarBg", "");
export const advAudioBarTextAtom = atomWithStorage("advAudioBarText", "");

export const advScrollbarColorAtom = atomWithStorage("advScrollbarColor", "");
export const advDialogBgAtom = atomWithStorage("advDialogBg", "");
export const advDialogBorderAtom = atomWithStorage("advDialogBorder", "");

export const advGlobalBorderRadiusAtom = atomWithStorage(
	"advGlobalBorderRadius",
	12,
);
export const advGlobalBorderWidthAtom = atomWithStorage(
	"advGlobalBorderWidth",
	1,
);
export const advShadowIntensityAtom = atomWithStorage("advShadowIntensity", 1);
export const advSelectionColorAtom = atomWithStorage("advSelectionColor", "");

export const appLayoutOrderAtom = atomWithStorage<string[]>("appLayoutOrder", [
	"titlebar",
	"ribbonbar",
	"editor",
	"audio-controls",
]);

export interface AppearancePresetSettings {
	accentColor: ExtractAtomValue<typeof accentColorAtom>;
	useCustomAccent: boolean;
	customAccentColor: string;
	glassBlur: number;
	backgroundMode: "none" | "image" | "gradient";
	selectedGradient: string;
	useCustomGradient: boolean;
	customGradientColors: string[];
	customGradientType: "linear" | "radial" | "conic";
	customGradientOpacity: number;
	customGradientCenter: [number, number];
	customGradientAngle: number;
	customGradientSize: number;
	appFont: string;
	appFontWeight: string;
	appFontStyle: string;
	customFontName: string | null;
	customFontData: string | null;
	interfaceScale: number;
	customBackgroundImageKey: string | null;
	customBackgroundOpacity: number;
	customBackgroundMask: number;
	customBackgroundBlur: number;
	customBackgroundBrightness: number;
	advWaveformColor: string;
	advWaveformProgress: string;
	advPrimaryText: string;
	advSecondaryText: string;
	vTitlebarBg: string;
	vSidebarBg: string;
	vSidebarActive: string;
	vMenuHover: string;
	vEditorBg: string;
	vActiveLine: string;
	vLineHover: string;
	vSelection: string;
	vChipRadius: number;
	vChipGap: number;
	vChipPaddingV: number;
	vChipPaddingH: number;
	vRomanColor: string;
	vTransColor: string;
	vGeniusHeaderColor: string;
	vAudioBarBg: string;
	vAudioBarText: string;
	vScrollbar: string;
	vDialogBg: string;
	vDialogBorder: string;
	vGlobalRadius: number;
	vGlobalBorderWidth: number;
	vShadow: number;
	vBackdrop: number;
	layoutOrder: string[];
	legacyDarkTheme: boolean;
	legacySpaceLabels: boolean;
	spicyLyricsDesign: boolean;
	logoColorPreset: string;
	logoColorCustom: string;
}

export interface AppearancePreset {
	id: string;
	name: string;
	settings: Partial<AppearancePresetSettings>;
}

export const appearancePresetsAtom = atomWithStorage<AppearancePreset[]>(
	"appearancePresets",
	[],
);

export const geniusCategorizationEnabledAtom = atomWithStorage<boolean>(
	"geniusCategorizationEnabled",
	false,
);

export const geniusHeaderDetectionDialogShownAtom = atomWithStorage<boolean>(
	"geniusHeaderDetectionDialogShown",
	false,
);

export const geniusHeaderDetectionDialogOpenAtom = atom(false);

/** Show "Updated to vX.Y.Z" the first time the app starts on a new version. */
export const showUpdatedToastAtom = atomWithStorage(
	"showUpdatedToast",
	true,
	undefined,
	{ getOnInit: true },
);
