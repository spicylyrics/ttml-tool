import { atomWithStorage } from "jotai/utils";

export enum SyncJudgeMode {
	FirstKeyDownTime = "first-keydown-time",
	FirstKeyDownTimeLegacy = "first-keydown-time-legacy",
	LastKeyUpTime = "last-keyup-time",
	MiddleKeyTime = "middle-key-time",
}

export enum LayoutMode {
	Simple = "simple",
	Advance = "advance",
}

export const geniusApiKeyAtom = atomWithStorage<string>("geniusApiKey", "");

export const latencyTestBPMAtom = atomWithStorage("latencyTestBPM", 120);

export const syncJudgeModeAtom = atomWithStorage(
	"syncJudgeMode",
	SyncJudgeMode.FirstKeyDownTime,
);

export const layoutModeAtom = atomWithStorage("layoutMode", LayoutMode.Simple);

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

export const hideSubmitAMLLDBWarningAtom = atomWithStorage(
	"hideSubmitAMLLDBWarning",
	false,
);
export const generateNameFromMetadataAtom = atomWithStorage(
	"generateNameFromMetadata",
	true,
);

export const autosaveEnabledAtom = atomWithStorage("autosaveEnabled", true);
export const autosaveIntervalAtom = atomWithStorage("autosaveInterval", 10);
export const autosaveLimitAtom = atomWithStorage("autosaveLimit", 10);

export const showTimestampsAtom = atomWithStorage("showTimestamps", true);

export const highlightActiveWordAtom = atomWithStorage(
	"highlightActiveWord",
	true,
);

export const highlightErrorsAtom = atomWithStorage("highlightErrors", false);
export const quickFixesAtom = atomWithStorage(
	"highlightGrammarWarnings",
	false,
);
export const ignoredQuickFixWordsAtom = atomWithStorage(
	"ignoredGrammarWords",
	[] as string[],
);

export const smartFirstWordAtom = atomWithStorage("smartFirstWord", false);
export const smartLastWordAtom = atomWithStorage("smartLastWord", false);



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
	| "ruby"
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

export const backgroundModeAtom = atomWithStorage<"none" | "image" | "gradient">(
	"backgroundMode",
	"none",
);

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

export const customGradientTypeAtom = atomWithStorage<"linear" | "radial" | "conic">(
	"customGradientType",
	"linear",
);

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

export const syncGradientToAccentAtom = atomWithStorage<boolean>(
	"syncGradientToAccent",
	false,
);
