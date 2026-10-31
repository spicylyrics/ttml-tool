// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { filterSearchOptions, SearchSelect } from ".";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
// jsdom has no layout, so these are no-ops for the list and Radix's popper.
Element.prototype.scrollIntoView = () => {};
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
} as unknown as typeof ResizeObserver;

const OPTIONS = [
	{ value: "timeShift", label: "Time shift...", group: "Edit" },
	{ value: "exportLrc", label: "Export lyrics: LRC", group: "File" },
	{ value: "loadAudio", label: "Load audio file", group: "Audio" },
	{ value: "edicion", label: "Edición", group: "Edit" },
];

describe("filterSearchOptions", () => {
	it("keeps everything for an empty query", () => {
		expect(filterSearchOptions(OPTIONS, "  ")).toHaveLength(4);
	});

	it("matches every word in the label or group, ignoring case and accents", () => {
		const values = (query: string) =>
			filterSearchOptions(OPTIONS, query).map((option) => option.value);
		expect(values("export lrc")).toEqual(["exportLrc"]);
		expect(values("AUDIO")).toEqual(["loadAudio"]);
		expect(values("file export")).toEqual(["exportLrc"]);
		expect(values("edicion")).toEqual(["edicion"]);
		expect(values("lrc audio")).toEqual([]);
	});
});

describe("SearchSelect", () => {
	let cleanup = () => {};
	afterEach(() => cleanup());

	function mount(onValueChange: (value: string) => void) {
		const container = document.createElement("div");
		document.body.append(container);
		const root = createRoot(container);
		act(() =>
			root.render(
				<Theme>
					<SearchSelect
						value={undefined}
						options={OPTIONS}
						onValueChange={onValueChange}
						label="Action"
						placeholder="Choose an action..."
						searchPlaceholder="Search actions"
						emptyText="No actions match"
					/>
				</Theme>,
			),
		);
		cleanup = () => {
			act(() => root.unmount());
			container.remove();
		};
		return container;
	}

	const type = (input: HTMLInputElement, text: string) => {
		const setter = Object.getOwnPropertyDescriptor(
			HTMLInputElement.prototype,
			"value",
		)?.set;
		act(() => {
			setter?.call(input, text);
			input.dispatchEvent(new Event("input", { bubbles: true }));
		});
	};
	const press = (input: HTMLInputElement, key: string) =>
		act(() => {
			input.dispatchEvent(
				new KeyboardEvent("keydown", { key, bubbles: true, cancelable: true }),
			);
		});

	it("filters what you type into the field and picks with the arrow keys and Enter", () => {
		const onValueChange = vi.fn();
		const container = mount(onValueChange);
		const input = container.querySelector<HTMLInputElement>(
			'input[role="combobox"]',
		);
		if (!input) throw new Error("field missing");
		expect(input.placeholder).toBe("Choose an action...");
		expect(input.getAttribute("aria-expanded")).toBe("false");

		type(input, "e");
		expect(input.getAttribute("aria-expanded")).toBe("true");
		const options = () =>
			[...document.querySelectorAll('[role="option"]')].map(
				(option) => option.textContent,
			);
		expect(options()).toEqual([
			"Time shift...",
			"Export lyrics: LRC",
			"Load audio file",
			"Edición",
		]);
		type(input, "lyrics");
		expect(options()).toEqual(["Export lyrics: LRC"]);
		type(input, "zzz");
		expect(document.body.textContent).toContain("No actions match");

		type(input, "");
		press(input, "ArrowDown");
		press(input, "ArrowDown");
		press(input, "Enter");
		expect(onValueChange).toHaveBeenCalledWith("loadAudio");
		expect(input.getAttribute("aria-expanded")).toBe("false");
	});

	it("opens with the arrow keys and closes with Esc", () => {
		const container = mount(vi.fn());
		const input = container.querySelector<HTMLInputElement>(
			'input[role="combobox"]',
		);
		if (!input) throw new Error("field missing");
		press(input, "ArrowDown");
		expect(input.getAttribute("aria-expanded")).toBe("true");
		expect(document.querySelectorAll('[role="option"]')).toHaveLength(4);
		press(input, "Escape");
		expect(input.getAttribute("aria-expanded")).toBe("false");
	});
});
