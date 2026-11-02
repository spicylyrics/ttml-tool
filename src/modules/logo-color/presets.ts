/**
 * Logo color presets. Values are plain `#rrggbb` rather than CSS tokens on
 * purpose: the desktop app icon is rasterized from the same value in Rust
 * (`src-tauri/src/app_icon.rs`), where tokens don't resolve.
 *
 * The history colors come from earlier `public/logo.svg` versions. Those
 * colored the tile; in the app only the glyph is tinted, so each one was
 * checked for at least 3:1 against the title bar (`--sl-chrome`).
 */
export const LOGO_COLOR_PRESETS = [
	{ id: "lilac", color: "#BEB4D9" }, // v3 logo glyph
	{ id: "purple", color: "#B915D4" }, // multicolor logo (v0.9.13 rebrand)
	{ id: "red", color: "#EF3838" }, // v0.9 red tile
	{ id: "gold", color: "#FFBB00" }, // multicolor logo
	{ id: "green", color: "#00CD3D" }, // multicolor logo
	{ id: "blue", color: "#4D8BFF" }, // multicolor blue, lightened to read on dark
	{ id: "white", color: "#FEFEFE" }, // v0.9 glyph
] as const;

export type LogoColorPresetId = (typeof LOGO_COLOR_PRESETS)[number]["id"];
export type LogoColorPreset = "default" | LogoColorPresetId | "custom";

export const LOGO_COLOR_PRESET_IDS: readonly LogoColorPreset[] = [
	"default",
	...LOGO_COLOR_PRESETS.map((preset) => preset.id),
	"custom",
];

export const DEFAULT_CUSTOM_LOGO_COLOR = "#B19EEF";

/** The CSS custom property the logo surfaces read, each with its own fallback. */
export const LOGO_COLOR_CSS_VAR = "--sl-logo-color";

const HEX_COLOR = /^#[0-9a-f]{6}$/i;

export function isHexColor(value: unknown): value is string {
	return typeof value === "string" && HEX_COLOR.test(value);
}

/**
 * The color to put on the logo, or `null` to leave today's look alone. Values
 * can come from a restored backup, so anything unexpected counts as default.
 */
export function resolveLogoColor(
	preset: string,
	custom: string,
): string | null {
	if (preset === "custom") return isHexColor(custom) ? custom : null;
	const match = LOGO_COLOR_PRESETS.find((item) => item.id === preset);
	return match?.color ?? null;
}
