import { atomWithStorage } from "jotai/utils";
import { DEFAULT_CUSTOM_LOGO_COLOR, type LogoColorPreset } from "./presets";

/**
 * Feature flag, off by default. While it is off the logo keeps the design's
 * own color and nothing else in this module has any effect.
 */
export const logoColorEnabledAtom = atomWithStorage<boolean>(
	"logoColorEnabled",
	false,
	undefined,
	{ getOnInit: true },
);

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
	"logoColorEnabled",
	"logoColorPreset",
	"logoColorCustom",
] as const;
