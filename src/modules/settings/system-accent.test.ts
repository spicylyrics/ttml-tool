import { describe, expect, it } from "vitest";
import { resolveAccentOverride } from "./system-accent";

const windows = { accent: "#0078D4", onDark: "#60CDFF", onLight: "#005FB8" };
const base = {
	useCustomAccent: false,
	customAccentColor: "#e5484d",
	useSystemAccent: true,
	systemAccent: windows,
	dark: true,
};

describe("resolveAccentOverride", () => {
	it("uses the shade Windows uses for controls on the current theme", () => {
		expect(resolveAccentOverride(base)).toBe("#60CDFF");
		expect(resolveAccentOverride({ ...base, dark: false })).toBe("#005FB8");
	});

	it("lets a custom accent win over the Windows one", () => {
		expect(resolveAccentOverride({ ...base, useCustomAccent: true })).toBe(
			"#e5484d",
		);
	});

	it("keeps the built-in accent when off or when Windows has none", () => {
		expect(resolveAccentOverride({ ...base, useSystemAccent: false })).toBe(
			null,
		);
		expect(resolveAccentOverride({ ...base, systemAccent: null })).toBe(null);
	});
});
