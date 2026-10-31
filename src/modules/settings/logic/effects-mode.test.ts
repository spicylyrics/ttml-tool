import { describe, expect, it } from "vitest";
import { usesLiteEffects } from "./effects-mode";

describe("usesLiteEffects", () => {
	it("turns lite effects on automatically only for the Linux desktop app", () => {
		expect(usesLiteEffects("auto", "linux")).toBe(true);
		expect(usesLiteEffects("auto", "windows")).toBe(false);
		expect(usesLiteEffects("auto", "macos")).toBe(false);
		expect(usesLiteEffects("auto", undefined)).toBe(false);
	});

	it("lets an explicit choice win on every platform", () => {
		expect(usesLiteEffects("full", "linux")).toBe(false);
		expect(usesLiteEffects("lite", "windows")).toBe(true);
		expect(usesLiteEffects("lite", undefined)).toBe(true);
	});
});
