import { describe, expect, it } from "vitest";
import {
	LOGO_COLOR_PRESET_IDS,
	LOGO_COLOR_PRESETS,
	resolveLogoColor,
} from "./presets";

describe("resolveLogoColor", () => {
	it("leaves the logo alone on the default preset", () => {
		expect(resolveLogoColor("default", "#123456")).toBeNull();
	});

	it("returns the preset color", () => {
		expect(resolveLogoColor("red", "#123456")).toBe("#EF3838");
		expect(resolveLogoColor("lilac", "#123456")).toBe("#BEB4D9");
	});

	it("returns a valid custom color", () => {
		expect(resolveLogoColor("custom", "#12ab9F")).toBe("#12ab9F");
	});

	it("ignores invalid values from a restored backup or preset", () => {
		expect(resolveLogoColor("custom", "red; color: blue")).toBeNull();
		expect(resolveLogoColor("custom", "#fff")).toBeNull();
		expect(resolveLogoColor("neon", "#123456")).toBeNull();
	});
});

describe("logo color presets", () => {
	it("lists default first, every preset once, and custom last", () => {
		expect(LOGO_COLOR_PRESET_IDS[0]).toBe("default");
		expect(LOGO_COLOR_PRESET_IDS[LOGO_COLOR_PRESET_IDS.length - 1]).toBe(
			"custom",
		);
		expect(new Set(LOGO_COLOR_PRESET_IDS).size).toBe(
			LOGO_COLOR_PRESETS.length + 2,
		);
	});

	it("uses #rrggbb values the desktop icon can rasterize", () => {
		for (const preset of LOGO_COLOR_PRESETS) {
			expect(preset.color).toMatch(/^#[0-9A-F]{6}$/);
		}
	});
});
