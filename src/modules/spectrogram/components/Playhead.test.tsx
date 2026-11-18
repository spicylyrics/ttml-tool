// @vitest-environment jsdom
import { createStore, Provider } from "jotai";
import { act, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { currentTimeAtom } from "$/modules/audio/states";
import { PlayheadCursor, ScrubHandle } from "./Playhead";

vi.mock("$/modules/audio/audio-engine", () => ({
	audioEngine: { beginScrub: vi.fn(), scrubTo: vi.fn(), endScrub: vi.fn() },
}));

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

describe("Playhead", () => {
	let root: Root;
	let container: HTMLDivElement;
	let store: ReturnType<typeof createStore>;
	let renders = 0;

	function Harness({ scrollLeft }: { scrollLeft: number }) {
		renders++;
		const ref = useRef<HTMLDivElement | null>(null);
		return (
			<div ref={ref}>
				<PlayheadCursor zoom={100} />
				<ScrubHandle
					scrollContainerRef={ref}
					scrollLeft={scrollLeft}
					zoom={100}
					containerWidth={500}
				/>
			</div>
		);
	}
	const render = (scrollLeft = 0) =>
		act(() =>
			root.render(
				<Provider store={store}>
					<Harness scrollLeft={scrollLeft} />
				</Provider>,
			),
		);
	const [cursor, handle] = [0, 1].map(
		(i) => () => container.firstElementChild?.children[i] as HTMLElement,
	);

	beforeEach(() => {
		store = createStore();
		renders = 0;
		container = document.createElement("div");
		document.body.append(container);
		root = createRoot(container);
	});
	afterEach(() => {
		act(() => root.unmount());
		container.remove();
	});

	it("follows the clock by transform without rendering again", () => {
		render();
		const before = renders;
		act(() => store.set(currentTimeAtom, 2500));
		expect(cursor().style.transform).toBe("translateX(250px)");
		expect(cursor().style.left).toBe("");
		expect(handle().style.transform).toBe("translateX(250px) translateX(-45%)");
		expect(renders).toBe(before);
	});

	it("hides the handle outside the visible range and shows it again", () => {
		store.set(currentTimeAtom, 1000);
		render(200);
		expect(handle().style.display).toBe("none");
		act(() => store.set(currentTimeAtom, 3000));
		expect(handle().style.display).toBe("block");
		expect(handle().style.transform).toBe("translateX(100px) translateX(-45%)");
		act(() => store.set(currentTimeAtom, 9000));
		expect(handle().style.display).toBe("none");
	});
});
