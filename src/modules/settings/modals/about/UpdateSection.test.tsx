// @vitest-environment jsdom
import type { Update } from "@tauri-apps/plugin-updater";
import { createStore, Provider } from "jotai";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const { check } = vi.hoisted(() => ({ check: vi.fn() }));
vi.mock("@tauri-apps/plugin-updater", () => ({ check }));
vi.mock("@tauri-apps/plugin-process", () => ({ relaunch: vi.fn() }));
vi.mock("@tauri-apps/plugin-shell", () => ({ open: vi.fn() }));

import { useAppUpdate } from "$/utils/useAppUpdate";
import { UpdateSection } from "./UpdateSection";
import { useAboutSettings } from "./useAboutSettings";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const Section = () => <UpdateSection {...useAboutSettings()} />;

const WithCheckButton = ({ children }: { children: ReactNode }) => {
	const { checkUpdate } = useAppUpdate();
	return (
		<>
			<button type="button" onClick={() => checkUpdate(true)}>
				check
			</button>
			{children}
		</>
	);
};

async function renderAfterCheck() {
	const container = document.createElement("div");
	const root = createRoot(container);
	act(() =>
		root.render(
			<Provider store={createStore()}>
				<WithCheckButton>
					<Section />
				</WithCheckButton>
			</Provider>,
		),
	);
	await act(async () => {
		container.querySelector("button")?.click();
	});
	return container;
}

const buttonNamed = (container: HTMLElement, name: string) =>
	[...container.querySelectorAll("button")].find((button) =>
		button.textContent?.includes(name),
	);

describe("UpdateSection", () => {
	it("shows why an install failed and lets the user try again", async () => {
		const downloadAndInstall = vi
			.fn<Update["downloadAndInstall"]>()
			.mockRejectedValue("Read-only file system (os error 30)");
		check.mockResolvedValue({ version: "9.9.9", body: "", downloadAndInstall });
		const errors = vi.spyOn(console, "error").mockImplementation(() => {});

		const container = await renderAfterCheck();
		await act(async () => {
			buttonNamed(container, "Update Now")?.click();
		});

		expect(container.querySelector('[role="alert"]')?.textContent).toContain(
			"Read-only file system (os error 30)",
		);
		expect(buttonNamed(container, "Download from GitHub")).toBeDefined();

		await act(async () => {
			buttonNamed(container, "Try again")?.click();
		});
		expect(downloadAndInstall).toHaveBeenCalledTimes(2);
		errors.mockRestore();
	});

	it("stays quiet when the background check fails", async () => {
		check.mockRejectedValue("offline");

		const container = await renderAfterCheck();

		expect(container.querySelector('[role="alert"]')).toBeNull();
		expect(buttonNamed(container, "Try again")).toBeUndefined();
	});
});
