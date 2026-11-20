// @vitest-environment jsdom
import { act, useRef } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useFlashOnChange } from "./use-flash-on-change";

Object.assign(globalThis, { IS_REACT_ACT_ENVIRONMENT: true });

function Probe({
	value,
	enabled,
	animate,
}: {
	value: number;
	enabled: boolean;
	animate: () => unknown;
}) {
	const ref = useRef<HTMLDivElement>(null);
	if (ref.current) ref.current.animate = animate as never;
	useFlashOnChange(ref, value, enabled);
	return <div ref={ref} />;
}

describe("flash on timestamp change", () => {
	afterEach(() => vi.restoreAllMocks());

	const mount = (value: number, enabled = true) => {
		const animate = vi.fn(() => ({ cancel: vi.fn() }));
		const root = createRoot(document.createElement("div"));
		// jsdom has no Element.animate; the prototype stub lets the hook call it.
		HTMLElement.prototype.animate = animate as never;
		const render = (nextValue: number, nextEnabled = enabled) =>
			act(() =>
				root.render(
					<Probe value={nextValue} enabled={nextEnabled} animate={animate} />,
				),
			);
		render(value);
		return { animate, render, unmount: () => act(() => root.unmount()) };
	};

	it("does not flash when a row first mounts", () => {
		const view = mount(1000);
		expect(view.animate).not.toHaveBeenCalled();
		view.unmount();
	});

	it("flashes when the timestamp changes", () => {
		const view = mount(1000);
		view.render(1500);
		expect(view.animate).toHaveBeenCalledOnce();
		view.unmount();
	});

	it("stays quiet when the setting is off", () => {
		const view = mount(1000, false);
		view.render(1500);
		expect(view.animate).not.toHaveBeenCalled();
		view.unmount();
	});
});
