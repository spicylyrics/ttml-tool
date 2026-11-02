import { atomWithStorage } from "jotai/utils";
import { DEFAULT_CUSTOM_LOGO_COLOR, type LogoColorPreset } from "./presets";

/** "default" leaves the logo and the app icon exactly as shipped. */
export const logoColorPresetAtom = atomWithStorage<LogoColorPreset>(
	"logoColorPreset",
	"default",
	undefined,
	{ getOnInit: true },
);

/** `#rrggbb`, used when the preset is `custom`. */
export const logoColorCustomAtom = atomWithStorage<string>(
	"logoColorCustom",
	DEFAULT_CUSTOM_LOGO_COLOR,
	undefined,
	{ getOnInit: true },
);

/** The localStorage keys above, so the backup test can check they travel. */
export const LOGO_COLOR_STORAGE_KEYS = [
	"logoColorPreset",
	"logoColorCustom",
] as const;
