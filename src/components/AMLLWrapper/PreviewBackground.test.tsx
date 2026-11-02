// @vitest-environment jsdom
import { act, StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";

const backgrounds = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@applemusic-like-lyrics/core", () => ({
	BackgroundRender: { new: backgrounds.create },
	MeshGradientRenderer: class {},
}));

import { PreviewBackground } from "./PreviewBackground";

describe("preview background lifecycle", () => {
	function mockBackground(load = Promise.resolve()) {
		const canvas = document.createElement("canvas");
		const loseContext = vi.fn();
		vi.spyOn(canvas, "getContext").mockReturnValue({
			getExtension: (name: string) =>
				name === "WEBGL_lose_context" ? { loseContext } : null,
		} as unknown as WebGLRenderingContext);
		return {
			loseContext,
			canvas,
			getElement: () => canvas,
			setRenderScale: vi.fn(),
			setAlbum: vi.fn(() => load),
			pause: vi.fn(),
			resume: vi.fn(),
			dispose: vi.fn(),
		};
	}

	it("disposes every renderer across repeated visits and Strict Mode", async () => {
		vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
		const instances: ReturnType<typeof mockBackground>[] = [];
		backgrounds.create.mockImplementation(() => {
			const background = mockBackground();
			instances.push(background);
			return background;
		});
		const container = document.createElement("div");
		const root = createRoot(container);
		try {
			for (let visit = 0; visit < 3; visit++) {
				await act(async () => {
					root.render(
						<StrictMode>
							<PreviewBackground playing />
						</StrictMode>,
					);
				});
				const active = instances[instances.length - 1];
				expect(active?.resume).toHaveBeenCalled();
				expect(container.querySelectorAll("canvas")).toHaveLength(1);
				await act(async () => {
					root.render(
						<StrictMode>
							<PreviewBackground playing={false} />
						</StrictMode>,
					);
				});
				expect(instances[instances.length - 1]).toBe(active);
				expect(active?.pause).toHaveBeenCalled();
				await act(async () => root.render(null));
				expect(container.querySelector("canvas")).toBeNull();
				for (const instance of instances) {
					expect(instance.pause).toHaveBeenCalled();
					expect(instance.dispose).toHaveBeenCalledTimes(1);
					expect(instance.loseContext).toHaveBeenCalledTimes(1);
				}
			}
			expect(instances).toHaveLength(6);
		} finally {
			await act(async () => root.unmount());
		}
	});

	it.each([
		false,
		true,
	])("stops immediately and releases a pending album load (reject=%s)", async (reject) => {
		vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
		const error = vi.spyOn(console, "error").mockImplementation(() => {});
		let resolveLoad = () => {};
		let rejectLoad = (_error: Error) => {};
		const load = new Promise<void>((resolve, reject) => {
			resolveLoad = resolve;
			rejectLoad = reject;
		});
		const background = mockBackground(load);
		backgrounds.create.mockReturnValue(background);
		const container = document.createElement("div");
		const root = createRoot(container);
		try {
			await act(async () => {
				root.render(<PreviewBackground album="cover.jpg" playing />);
			});
			expect(background.setAlbum).toHaveBeenCalledWith("cover.jpg");
			expect(background.setRenderScale).toHaveBeenCalledWith(0.5);
			await act(async () => root.render(null));
			expect(background.pause).toHaveBeenCalled();
			expect(container.querySelector("canvas")).toBeNull();
			expect(background.dispose).not.toHaveBeenCalled();
			expect(background.loseContext).not.toHaveBeenCalled();
			background.resume.mockClear();
			await act(async () => {
				if (reject) rejectLoad(new Error("Image load failed"));
				else resolveLoad();
			});
			expect(background.dispose).toHaveBeenCalledTimes(1);
			expect(background.loseContext).toHaveBeenCalledTimes(1);
			expect(background.resume).not.toHaveBeenCalled();
			expect(error).toHaveBeenCalledTimes(reject ? 1 : 0);
		} finally {
			error.mockRestore();
			await act(async () => root.unmount());
		}
	});
});
