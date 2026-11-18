// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { audioBufferAtom } from "$/modules/audio/states";
import { useScrubbing } from "./useScrubbing";

const engine = vi.hoisted(() => ({
	beginScrub: vi.fn(),
	scrubTo: vi.fn(),
	endScrub: vi.fn(),
}));
vi.mock("$/modules/audio/audio-engine", () => ({ audioEngine: engine }));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("useScrubbing", () => {
	let root: Root;
	let store: ReturnType<typeof createStore>;
	let start: ((event: React.MouseEvent) => void) | null = null;

	function Harness({ scrollLeft, zoom }: { scrollLeft: number; zoom: number }) {
		const ref = useRef<HTMLDivElement | null>(null);
		start = useScrubbing(ref, scrollLeft, zoom).handleScrubStart;
		return (
			<div
				ref={(node) => {
					ref.current = node;
					if (node)
						node.getBoundingClientRect = () =>
							({ left: 0, width: 1000 }) as DOMRect;
				}}
			/>
		);
	}
	const render = (scrollLeft: number, zoom = 100) =>
		act(() =>
			root.render(
				<Provider store={store}>
					<Harness scrollLeft={scrollLeft} zoom={zoom} />
				</Provider>,
			),
		);
	const lastTime = () => engine.scrubTo.mock.calls.slice(-1)[0]?.[0];

	beforeEach(() => {
		for (const fn of Object.values(engine)) fn.mockReset();
		store = createStore();
		store.set(audioBufferAtom, { duration: 100 } as AudioBuffer);
		root = createRoot(document.createElement("div"));
	});
	afterEach(() => act(() => root.unmount()));

	it("moves the playhead when the view scrolls under a still pointer", () => {
		render(0);
		act(() =>
			start?.({
				button: 0,
				preventDefault() {},
				nativeEvent: { clientX: 500 },
			} as unknown as React.MouseEvent),
		);
		expect(engine.beginScrub).toHaveBeenCalledOnce();
		expect(lastTime()).toBe(5);
		render(300);
		expect(lastTime()).toBe(8);
		act(() => {
			window.dispatchEvent(new MouseEvent("mousemove", { clientX: 600 }));
		});
		expect(lastTime()).toBe(9);
	});

	it("keeps the drag through a zoom and ends it once on release", () => {
		render(0);
		act(() =>
			start?.({
				button: 0,
				preventDefault() {},
				nativeEvent: { clientX: 500 },
			} as unknown as React.MouseEvent),
		);
		render(0, 50);
		expect(engine.endScrub).not.toHaveBeenCalled();
		expect(lastTime()).toBe(10);
		act(() => {
			window.dispatchEvent(new MouseEvent("mouseup"));
			window.dispatchEvent(new MouseEvent("mouseup"));
		});
		expect(engine.endScrub).toHaveBeenCalledOnce();
		act(() => {
			window.dispatchEvent(new MouseEvent("mousemove", { clientX: 100 }));
		});
		expect(lastTime()).toBe(10);
	});
});
