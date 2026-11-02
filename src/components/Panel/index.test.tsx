// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Panel, SelectablePanel } from ".";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;

const cleanups: (() => void)[] = [];
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
});

function render(node: ReactNode) {
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() => root.render(<Theme>{node}</Theme>));
	cleanups.push(() => {
		act(() => root.unmount());
		container.remove();
	});
	return container;
}

describe("Panel", () => {
	it("renders a card with its tone", () => {
		const container = render(<Panel tone="sunken">Example</Panel>);
		const panel = container.querySelector("[data-panel-tone]");
		expect(panel?.getAttribute("data-panel-tone")).toBe("sunken");
		expect(panel?.classList.contains("rt-Card")).toBe(true);
		expect(panel?.textContent).toBe("Example");
	});
});

describe("SelectablePanel", () => {
	it("is a button that reports its selection", () => {
		const onClick = vi.fn();
		const container = render(
			<SelectablePanel selected onClick={onClick}>
				Arial
			</SelectablePanel>,
		);
		const button = container.querySelector("button");
		expect(button?.getAttribute("type")).toBe("button");
		expect(button?.getAttribute("aria-pressed")).toBe("true");
		expect(button?.hasAttribute("data-selected")).toBe(true);
		act(() => button?.click());
		expect(onClick).toHaveBeenCalledOnce();
	});

	it("drops the selected mark when not selected", () => {
		const container = render(<SelectablePanel>Arial</SelectablePanel>);
		const button = container.querySelector("button");
		expect(button?.getAttribute("aria-pressed")).toBe("false");
		expect(button?.hasAttribute("data-selected")).toBe(false);
	});
});
