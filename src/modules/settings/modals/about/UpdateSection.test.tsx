// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import type { Update } from "@tauri-apps/plugin-updater";
import i18n from "i18next";
import ICU from "i18next-icu";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import { UpdateSection } from "./UpdateSection";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const update = {
	version: "0.23.0-2",
	body: "## New\n- **Beta switch.** Try it",
	rawJson: {
		entries: [
			{ type: "feature", title: "Beta switch", body: "Try it" },
			{ type: "fix", title: "Crash on save", body: "Saving works again" },
		],
	},
} as unknown as Update;

async function render(props: { canSelfUpdate: boolean; installKind: string }) {
	const instance = i18n.createInstance().use(ICU);
	await instance.init({ lng: "en-US", resources: {} });
	const t = instance.t.bind(instance) as Parameters<
		typeof UpdateSection
	>[0]["t"];
	const container = document.createElement("div");
	const root = createRoot(container);
	act(() =>
		root.render(
			<Theme>
				<UpdateSection
					t={t}
					status="available"
					update={update}
					progress={0}
					installUpdate={async () => {}}
					restartApp={async () => {}}
					showUpdateCard
					{...props}
				/>
			</Theme>,
		),
	);
	const text = container.textContent ?? "";
	act(() => root.unmount());
	return text;
}

describe("UpdateSection", () => {
	it("names betas and lists the release's entries by section", async () => {
		const text = await render({ canSelfUpdate: true, installKind: "nsis" });
		expect(text).toContain("0.23.0 Beta 2");
		expect(text).toContain("NewBeta switch. Try it");
		expect(text).toContain("FixedCrash on save. Saving works again");
		expect(text).not.toContain("**");
		expect(text).toContain("Update Now");
	});

	it("sends installs that can't update themselves to the download page", async () => {
		const flatpak = await render({
			canSelfUpdate: false,
			installKind: "flatpak",
		});
		expect(flatpak).toContain("Open download page");
		expect(flatpak).not.toContain("Update Now");
		const aur = await render({ canSelfUpdate: false, installKind: "aur" });
		expect(aur).toContain("AUR helper");
		expect(aur).not.toContain("Open download page");
	});
});
