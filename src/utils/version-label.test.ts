import { describe, expect, it } from "vitest";
import { isBetaVersion, parseAppVersion, versionLabel } from "./version-label";

describe("version labels", () => {
	it("reads stable and beta versions", () => {
		expect(parseAppVersion("0.22.0")).toEqual({ base: "0.22.0", beta: null });
		expect(parseAppVersion("0.23.0-12")).toEqual({ base: "0.23.0", beta: 12 });
	});

	it("names betas by number", () => {
		expect(versionLabel("0.23.0-2")).toBe("0.23.0 Beta 2");
		expect(versionLabel("0.22.0")).toBe("0.22.0");
		expect(isBetaVersion("0.23.0-1")).toBe(true);
		expect(isBetaVersion("0.23.0")).toBe(false);
	});

	it("leaves anything else as it is", () => {
		expect(versionLabel("0.23.0-beta.1")).toBe("0.23.0-beta.1");
	});
});
