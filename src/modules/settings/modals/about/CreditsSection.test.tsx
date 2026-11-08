// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import i18n from "i18next";
import ICU from "i18next-icu";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { CreditsSection } from "./CreditsSection";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

describe("CreditsSection", () => {
	it("always names every project and shows roles and licenses on request", async () => {
		const instance = i18n.createInstance().use(ICU);
		await instance.init({ lng: "en-US", resources: {} });
		const t = instance.t.bind(instance) as Parameters<
			typeof CreditsSection
		>[0]["t"];
		const container = document.createElement("div");
		const root = createRoot(container);
		act(() =>
			root.render(
				<Theme>
					<CreditsSection t={t} />
				</Theme>,
			),
		);

		for (const name of ["Spicy Lyrics", "mecab-ipadic", "ToJyutping"])
			expect(container.textContent).toContain(name);
		expect(container.textContent).not.toContain("AGPL-3.0-or-later");

		const toggle = container.querySelector("button[aria-expanded]");
		expect(toggle?.getAttribute("aria-expanded")).toBe("false");
		act(() =>
			toggle?.dispatchEvent(new MouseEvent("click", { bubbles: true })),
		);

		expect(toggle?.getAttribute("aria-expanded")).toBe("true");
		expect(container.textContent).toContain("AGPL-3.0-or-later");
		expect(container.textContent).toContain(
			"Copyright 2000-2003 Nara Institute of Science and Technology",
		);
		act(() => root.unmount());
	});
});
