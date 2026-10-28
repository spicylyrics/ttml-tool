// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act, type MouseEvent as ReactMouseEvent } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it } from "vitest";
import {
	spectrogramContainerWidthAtom,
	spectrogramHoverPxAtom,
	spectrogramScrollLeftAtom,
	spectrogramSelectionAtom,
	spectrogramZoomAtom,
} from "../states";
import { useSpectrogramSelection } from "./useSpectrogramSelection";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("spectrogram range selection", () => {
	it("follows the pointer only while dragging and still selects the dragged range", () => {
		const store = createStore();
		store.set(spectrogramZoomAtom, 100);
		store.set(spectrogramScrollLeftAtom, 0);
		store.set(spectrogramContainerWidthAtom, 1000);
		let renders = 0;
		let view!: ReturnType<typeof useSpectrogramSelection>;
		function Harness() {
			view = useSpectrogramSelection(0, 100);
			renders++;
			return null;
		}
		const root = createRoot(document.createElement("div"));
		try {
			act(() =>
				root.render(
					<Provider store={store}>
						<Harness />
					</Provider>,
				),
			);
			const idle = renders;
			act(() => store.set(spectrogramHoverPxAtom, 50));
			expect(renders).toBe(idle);

			const target = document.createElement("div");
			target.getBoundingClientRect = () => ({ left: 0 }) as DOMRect;
			act(() =>
				view.handleSelectionMouseDown({
					clientX: 100,
					currentTarget: target,
				} as unknown as ReactMouseEvent<HTMLDivElement>),
			);
			act(() => store.set(spectrogramHoverPxAtom, 300));
			expect(view.selectionStyle).toMatchObject({
				left: "100px",
				width: "200px",
			});
			act(() => {
				window.dispatchEvent(new MouseEvent("mouseup"));
			});
			expect(store.get(spectrogramSelectionAtom)).toEqual({
				start: 1000,
				end: 3000,
			});
		} finally {
			act(() => root.unmount());
		}
	});
});
