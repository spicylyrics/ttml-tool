// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { act, type ReactNode, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it } from "vitest";
import { NameListInput, splitNames } from ".";

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

let latest: string[] = [];
const Harness = ({ initial }: { initial: string[] }) => {
	const [values, setValues] = useState(initial);
	latest = values;
	return <NameListInput values={values} onChange={setValues} id="names" />;
};

const input = (container: HTMLElement) =>
	container.querySelector<HTMLInputElement>("#names") as HTMLInputElement;

function typeInto(element: HTMLInputElement, text: string) {
	const setter = Object.getOwnPropertyDescriptor(
		HTMLInputElement.prototype,
		"value",
	)?.set;
	act(() => {
		setter?.call(element, text);
		element.dispatchEvent(new Event("input", { bubbles: true }));
	});
}

const press = (element: HTMLElement, key: string) =>
	act(() => {
		element.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
	});

describe("splitNames", () => {
	it("splits on list separators and trims", () => {
		expect(splitNames("A, B & C;D")).toEqual(["A", "B", "C", "D"]);
		expect(splitNames("Solo")).toEqual(["Solo"]);
	});
});

describe("NameListInput", () => {
	it("adds a typed name on Enter and skips duplicates", () => {
		const container = render(<Harness initial={["Taylor Swift"]} />);
		typeInto(input(container), "Max Martin");
		press(input(container), "Enter");
		expect(latest).toEqual(["Taylor Swift", "Max Martin"]);
		typeInto(input(container), "taylor swift");
		press(input(container), "Enter");
		expect(latest).toEqual(["Taylor Swift", "Max Martin"]);
	});

	it("takes the last name back for editing on Backspace", () => {
		const container = render(<Harness initial={["A", "B"]} />);
		press(input(container), "Backspace");
		expect(latest).toEqual(["A"]);
		expect(input(container).value).toBe("B");
	});

	it("offers to split a saved value that holds several names", () => {
		const container = render(<Harness initial={["A, B & C", "D"]} />);
		const split = [...container.querySelectorAll("button")].find(
			(button) => !button.hasAttribute("aria-label"),
		);
		expect(split).toBeDefined();
		act(() => split?.click());
		expect(latest).toEqual(["A", "B", "C", "D"]);
	});

	it("removes a name with its labelled button", () => {
		const container = render(<Harness initial={["A"]} />);
		const remove = container.querySelector("button[aria-label]");
		expect(remove).not.toBeNull();
		act(() => (remove as HTMLButtonElement).click());
		expect(latest).toEqual([]);
	});
});
