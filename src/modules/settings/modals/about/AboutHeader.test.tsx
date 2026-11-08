// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import i18n from "i18next";
import ICU from "i18next-icu";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const buildmeta = vi.hoisted(() => ({ APP_VERSION: "0.23.0-2" }));
vi.mock("virtual:buildmeta", () => buildmeta);

import { AboutHeader } from "./AboutHeader";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

async function render() {
	const instance = i18n.createInstance().use(ICU);
	await instance.init({ lng: "en-US", resources: {} });
	const t = instance.t.bind(instance) as Parameters<typeof AboutHeader>[0]["t"];
	const container = document.createElement("div");
	const root = createRoot(container);
	act(() =>
		root.render(
			<Theme>
				<AboutHeader t={t} />
			</Theme>,
		),
	);
	const text = container.textContent ?? "";
	act(() => root.unmount());
	return text;
}

describe("AboutHeader", () => {
	it("leads with the version and marks betas", async () => {
		buildmeta.APP_VERSION = "0.23.0-2";
		const text = await render();
		expect(text).toContain("Spicy Lyrics TTML Tool");
		expect(text).toContain("0.23.0 Beta 2");
		expect(text).toContain("Beta");
	});

	it("shows a stable version without the badge", async () => {
		buildmeta.APP_VERSION = "0.23.0";
		const text = await render();
		expect(text).toContain("0.23.0");
		expect(text).not.toContain("Beta");
	});
});
