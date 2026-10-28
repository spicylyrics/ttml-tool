import { describe, expect, it } from "vitest";
import {
	LOGO_COLOR_PRESET_IDS,
	LOGO_COLOR_PRESETS,
	resolveLogoColor,
} from "./presets";

describe("resolveLogoColor", () => {
	it("leaves the logo alone while the flag is off", () => {
		expect(resolveLogoColor(false, "red", "#123456")).toBeNull();
		expect(resolveLogoColor(false, "custom", "#123456")).toBeNull();
	});

	it("leaves the logo alone on the default preset", () => {
		expect(resolveLogoColor(true, "default", "#123456")).toBeNull();
	});

	it("returns the preset color", () => {
		expect(resolveLogoColor(true, "red", "#123456")).toBe("#EF3838");
		expect(resolveLogoColor(true, "lilac", "#123456")).toBe("#BEB4D9");
	});

	it("returns a valid custom color", () => {
		expect(resolveLogoColor(true, "custom", "#12ab9F")).toBe("#12ab9F");
	});

	it("ignores invalid values from a restored backup", () => {
		expect(resolveLogoColor(true, "custom", "red; color: blue")).toBeNull();
		expect(resolveLogoColor(true, "custom", "#fff")).toBeNull();
		expect(resolveLogoColor(true, "neon", "#123456")).toBeNull();
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
