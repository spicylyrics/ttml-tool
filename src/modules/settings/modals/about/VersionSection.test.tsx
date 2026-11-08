// @vitest-environment jsdom
import i18n from "i18next";
import ICU from "i18next-icu";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

vi.mock("virtual:buildmeta", () => ({
	BUILD_TIME: "2026-10-11",
	GIT_COMMIT: "abc1234",
	APP_VERSION: "0.23.0-2",
}));

import { VersionSection } from "./VersionSection";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("VersionSection", () => {
	it("renders the commit link inside the translated line without key warnings", async () => {
		const instance = i18n.createInstance().use(ICU);
		await instance.init({ lng: "en-US", resources: {} });
		const t = instance.t.bind(instance) as Parameters<
			typeof VersionSection
		>[0]["t"];
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});

		const container = document.createElement("div");
		const root = createRoot(container);
		act(() => root.render(<VersionSection t={t} />));

		expect(container.textContent).toContain("Version: 0.23.0 Beta 2");
		expect(container.textContent).toContain("Git commit: abc1234");
		expect(container.querySelector("a")?.textContent).toBe("abc1234");
		expect(errors).not.toHaveBeenCalled();
		act(() => root.unmount());
		errors.mockRestore();
	});
});
