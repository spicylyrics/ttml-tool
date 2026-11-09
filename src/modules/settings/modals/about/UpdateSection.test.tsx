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

async function render(
	props: Partial<Parameters<typeof UpdateSection>[0]> & {
		canSelfUpdate: boolean;
		installKind: string;
	},
) {
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
					isWebsite={false}
					status="available"
					update={update}
					progress={0}
					errorMsg=""
					installUpdate={async () => {}}
					restartApp={async () => {}}
					checkUpdate={async () => {}}
					showUpdateCard
					betaUpdates={false}
					setBetaUpdates={() => {}}
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

	it("tells a Mac copy on a read-only volume to move to Applications", async () => {
		const text = await render({
			canSelfUpdate: false,
			installKind: "app-read-only",
		});
		expect(text).toContain("Applications folder");
		expect(text).toContain("Open download page");
		expect(text).not.toContain("Update Now");
	});

	it("shows why an install failed, with retry and download", async () => {
		const text = await render({
			canSelfUpdate: true,
			installKind: "app",
			status: "install-failed",
			errorMsg: "Read-only file system (os error 30)",
		});
		expect(text).toContain("Couldn't install the update");
		expect(text).toContain("Read-only file system (os error 30)");
		expect(text).toContain("Try again");
		expect(text).toContain("Open download page");
		expect(text).not.toContain("Check your connection");
	});

	it("shows the check button, the result and the beta switch with no update", async () => {
		const text = await render({
			canSelfUpdate: true,
			installKind: "nsis",
			status: "up-to-date",
			update: null,
			showUpdateCard: false,
		});
		expect(text).toContain("Check for updates");
		expect(text).toContain("You have the newest version");
		expect(text).toContain("Beta updates");
		expect(text).not.toContain("Update Now");
	});

	it("keeps the beta switch next to an offered update", async () => {
		const text = await render({ canSelfUpdate: true, installKind: "nsis" });
		expect(text).toContain("Beta updates");
		expect(text).not.toContain("Check for updates");
	});

	it("shows nothing on the website, which has no updater", async () => {
		const text = await render({
			canSelfUpdate: false,
			installKind: "web",
			isWebsite: true,
		});
		expect(text).toBe("");
	});
});
