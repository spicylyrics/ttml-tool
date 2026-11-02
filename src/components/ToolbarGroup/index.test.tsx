// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { ToolbarGroup } from ".";

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

describe("ToolbarGroup", () => {
	it("names the group and holds its controls", () => {
		const container = render(
			<ToolbarGroup label="Zoom">
				<button type="button">In</button>
				<button type="button">Out</button>
			</ToolbarGroup>,
		);
		const group = container.querySelector("[role=group]");
		expect(group?.getAttribute("aria-label")).toBe("Zoom");
		expect(group?.querySelectorAll("button")).toHaveLength(2);
		expect(container.querySelector(".rt-Separator")).toBeNull();
	});

	it("can show its caption and a separator", () => {
		const container = render(
			<ToolbarGroup label="Zoom" showLabel separated>
				<button type="button">In</button>
			</ToolbarGroup>,
		);
		expect(container.querySelector("span[aria-hidden]")?.textContent).toBe(
			"Zoom",
		);
		expect(container.querySelector(".rt-Separator")).not.toBeNull();
	});
});
