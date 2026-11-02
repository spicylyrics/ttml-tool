// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { SectionHeader } from ".";

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

describe("SectionHeader", () => {
	it("renders the heading level, description and actions", () => {
		const container = render(
			<SectionHeader
				as="h2"
				id="fonts"
				title="System fonts"
				description="Installed on this computer."
				actions={<button type="button">Refresh</button>}
			/>,
		);
		const heading = container.querySelector("h2");
		expect(heading?.id).toBe("fonts");
		expect(heading?.textContent).toBe("System fonts");
		expect(container.querySelector("p")?.textContent).toBe(
			"Installed on this computer.",
		);
		expect(container.querySelector("button")?.textContent).toBe("Refresh");
	});

	it("defaults to an h3 with nothing else", () => {
		const container = render(<SectionHeader title="Autosave" />);
		expect(container.querySelector("h3")?.textContent).toBe("Autosave");
		expect(container.querySelector("p")).toBeNull();
		expect(container.querySelector("button")).toBeNull();
	});
});
