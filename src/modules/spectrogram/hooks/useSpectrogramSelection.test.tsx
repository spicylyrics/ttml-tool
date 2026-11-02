// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act, type MouseEvent as ReactMouseEvent } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import { editingTimeFieldAtom } from "$/states/main";
import {
	spectrogramContainerWidthAtom,
	spectrogramHoverPxAtom,
	spectrogramScrollLeftAtom,
	spectrogramSelectionAtom,
	spectrogramZoomAtom,
} from "../states";
import { useSpectrogramSelection } from "./useSpectrogramSelection";
import { useTimelineEditing } from "./useTimelineEditing";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("spectrogram range selection", () => {
	it("preserves a pending line start while the panel is closed and reopened", () => {
		vi.useFakeTimers();
		const store = createStore();
		store.set(editingTimeFieldAtom, { isWord: false, field: "startTime" });
		let view!: ReturnType<typeof useTimelineEditing>;
		function Harness() {
			view = useTimelineEditing(0, 100);
			return null;
		}
		const root = createRoot(document.createElement("div"));
		const render = () =>
			act(() =>
				root.render(
					<Provider store={store}>
						<Harness />
					</Provider>,
				),
			);
		try {
			render();
			const target = document.createElement("div");
			target.getBoundingClientRect = () => ({ left: 0 }) as DOMRect;
			act(() =>
				view.handleContainerMouseDown({
					clientX: 100,
					currentTarget: target,
					preventDefault() {},
				} as unknown as ReactMouseEvent<HTMLDivElement>),
			);
			expect(view.referenceStartTime).toBe(1000);
			act(() => root.render(null));
			store.set(editingTimeFieldAtom, { isWord: false, field: "endTime" });
			render();
			expect(view.referenceStartTime).toBe(1000);
			expect(view.pendingCursorPosition).toBe(100);
		} finally {
			act(() => root.unmount());
			vi.clearAllTimers();
			vi.useRealTimers();
		}
	});

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
