// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { EmptyState } from ".";

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

describe("EmptyState", () => {
	it("renders the title, description, decorative icon and actions", () => {
		const container = render(
			<EmptyState
				icon={<svg data-testid="icon" />}
				title="No lyric lines"
				description="Add lines from the ribbon above."
				actions={<button type="button">Add line</button>}
			/>,
		);
		const root = container.querySelector("[data-empty-state]");
		const texts = [...(root?.querySelectorAll("p") ?? [])].map(
			(node) => node.textContent,
		);
		expect(texts).toEqual([
			"No lyric lines",
			"Add lines from the ribbon above.",
		]);
		expect(
			container
				.querySelector("[data-testid=icon]")
				?.parentElement?.getAttribute("aria-hidden"),
		).toBe("true");
		expect(container.querySelector("button")?.textContent).toBe("Add line");
	});

	it("needs only a title", () => {
		const container = render(<EmptyState title="Nothing found" />);
		expect(container.querySelectorAll("p")).toHaveLength(1);
		expect(container.querySelector("[aria-hidden]")).toBeNull();
	});
});
