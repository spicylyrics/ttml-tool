// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { act, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { FieldRow } from ".";

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

describe("FieldRow", () => {
	it("ties the label and description to the control", () => {
		const container = render(
			<FieldRow label="Autosave" description="Saves after each change.">
				{({ controlId, descriptionId }) => (
					<input
						type="checkbox"
						id={controlId}
						aria-describedby={descriptionId}
					/>
				)}
			</FieldRow>,
		);
		const input = container.querySelector("input");
		const label = container.querySelector("label");
		expect(label?.textContent).toBe("Autosave");
		expect(label?.htmlFor).toBe(input?.id);
		const description = document.getElementById(
			input?.getAttribute("aria-describedby") ?? "",
		);
		expect(description?.textContent).toBe("Saves after each change.");
	});

	it("accepts a plain control and leaves out a missing description", () => {
		const container = render(
			<FieldRow label="Speed" stacked>
				<span data-testid="control">slider</span>
			</FieldRow>,
		);
		const row = container.querySelector("[data-field-row]");
		expect(row?.hasAttribute("data-stacked")).toBe(true);
		expect(row?.querySelector("p")).toBeNull();
		expect(container.querySelector("[data-testid=control]")).not.toBeNull();
	});
});
