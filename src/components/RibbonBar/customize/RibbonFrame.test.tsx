// @vitest-environment jsdom
import { Theme } from "@radix-ui/themes";
import { createStore, Provider } from "jotai";
import { act, type FC, type ReactNode } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Labels resolve to their keys, so a section's label is its catalog id.
vi.mock("react-i18next", () => ({
	useTranslation: () => ({
		t: (key: string, ...rest: unknown[]) => {
			const options = rest.find(
				(arg): arg is { name: string } =>
					typeof arg === "object" && arg !== null && "name" in arg,
			);
			return options ? `${key}:${options.name}` : key;
		},
		i18n: { language: "en-US" },
	}),
}));

import { RibbonFrame, RibbonSection } from "../common";
import {
	RibbonModeContext,
	ribbonCustomizeEnabledAtom,
	ribbonLayoutsAtom,
} from "./states";

(
	globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }
).IS_REACT_ACT_ENVIRONMENT = true;
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
};

// The storage atoms read localStorage again when they mount.
class MemoryStorage {
	private data = new Map<string, string>();
	get length() {
		return this.data.size;
	}
	key(index: number) {
		return [...this.data.keys()][index] ?? null;
	}
	getItem(key: string) {
		return this.data.get(key) ?? null;
	}
	setItem(key: string, value: string) {
		this.data.set(key, String(value));
	}
	removeItem(key: string) {
		this.data.delete(key);
	}
	clear() {
		this.data.clear();
	}
}

const cleanups: (() => void)[] = [];
beforeEach(() => {
	vi.stubGlobal("localStorage", new MemoryStorage());
});
afterEach(() => {
	for (const cleanup of cleanups.splice(0)) cleanup();
	vi.unstubAllGlobals();
});

/** Stands in for a component that wraps its own RibbonSection. */
const Wrapped: FC = () => (
	<RibbonSection label="Wrapped">
		<span data-testid="ribbonBar.previewMode.timing" />
	</RibbonSection>
);

const Ribbon: FC = () => (
	<RibbonFrame>
		<RibbonSection label="ribbonBar.previewMode.mode">
			<span data-testid="ribbonBar.previewMode.mode" />
		</RibbonSection>
		{false}
		<RibbonSection label="ribbonBar.previewMode.spicy">
			<span data-testid="ribbonBar.previewMode.spicy" />
		</RibbonSection>
		<Wrapped key="ribbonBar.previewMode.timing" />
		<RibbonSection label="ribbonBar.previewMode.lyrics">
			<span data-testid="ribbonBar.previewMode.lyrics" />
		</RibbonSection>
		<RibbonSection label="Advanced">
			<span data-testid="advanced" />
		</RibbonSection>
	</RibbonFrame>
);

function render(
	{ enabled, layouts }: { enabled: boolean; layouts?: unknown },
	node: ReactNode = <Ribbon />,
) {
	const store = createStore();
	store.set(ribbonCustomizeEnabledAtom, enabled);
	if (layouts) store.set(ribbonLayoutsAtom, { preview: layouts });
	const container = document.createElement("div");
	document.body.appendChild(container);
	const root = createRoot(container);
	act(() =>
		root.render(
			<Provider store={store}>
				<Theme>
					<RibbonModeContext.Provider value="preview">
						{node}
					</RibbonModeContext.Provider>
				</Theme>
			</Provider>,
		),
	);
	cleanups.push(() => {
		act(() => root.unmount());
		container.remove();
	});
	return container;
}

const order = (container: HTMLElement) =>
	Array.from(container.querySelectorAll("[data-testid]")).map((node) =>
		node.getAttribute("data-testid"),
	);

const TODAY = [
	"ribbonBar.previewMode.mode",
	"ribbonBar.previewMode.spicy",
	"ribbonBar.previewMode.timing",
	"ribbonBar.previewMode.lyrics",
	"advanced",
];

describe("RibbonFrame customizing", () => {
	it("renders exactly today's ribbon with the flag off, even with a saved layout", () => {
		const container = render({
			enabled: false,
			layouts: { order: ["ribbonBar.previewMode.lyrics"] },
		});
		expect(order(container)).toEqual(TODAY);
		expect(
			container.querySelector('[aria-label="ribbonCustomize.customize"]'),
		).toBeNull();
	});

	it("keeps today's order with the flag on and no saved layout", () => {
		const container = render({ enabled: true });
		expect(order(container)).toEqual(TODAY);
		expect(
			container.querySelector('[aria-label="ribbonCustomize.customize"]'),
		).not.toBeNull();
		// Nothing is in More, so there's no More button.
		expect(
			container.querySelector('[aria-label="ribbonCustomize.more"]'),
		).toBeNull();
	});

	it("applies the saved layout to the real elements", () => {
		const container = render({
			enabled: true,
			layouts: {
				order: [
					"ribbonBar.previewMode.mode",
					"ribbonBar.previewMode.timing",
					"ribbonBar.previewMode.spicy",
					"ribbonBar.previewMode.lyrics",
				],
				pinned: ["ribbonBar.previewMode.lyrics"],
				placement: {
					"ribbonBar.previewMode.mode": "hidden",
					"ribbonBar.previewMode.spicy": "more",
				},
			},
		});
		expect(order(container)).toEqual([
			"ribbonBar.previewMode.lyrics",
			"ribbonBar.previewMode.timing",
			"advanced",
		]);
		expect(
			container.querySelector('[aria-label="ribbonCustomize.more"]'),
		).not.toBeNull();
	});

	it("moves and pins sections from the Customize panel by keyboard-reachable buttons", () => {
		const container = render({ enabled: true });
		const button = (label: string) => {
			const found = document.querySelector<HTMLButtonElement>(
				`[aria-label="${label}"]`,
			);
			if (!found) throw new Error(`No button ${label}`);
			return found;
		};
		act(() => button("ribbonCustomize.customize").click());

		const moveUp = button("ribbonCustomize.moveUp:ribbonBar.previewMode.mode");
		expect(moveUp.disabled).toBe(true);
		const moveDown = button(
			"ribbonCustomize.moveDown:ribbonBar.previewMode.mode",
		);
		moveDown.focus();
		act(() => moveDown.click());
		expect(order(container)).toEqual([
			"ribbonBar.previewMode.spicy",
			"ribbonBar.previewMode.mode",
			"ribbonBar.previewMode.timing",
			"ribbonBar.previewMode.lyrics",
			"advanced",
		]);
		// Focus stays on the button that was pressed.
		expect(document.activeElement?.getAttribute("aria-label")).toBe(
			"ribbonCustomize.moveDown:ribbonBar.previewMode.mode",
		);

		act(() =>
			button("ribbonCustomize.pin:ribbonBar.previewMode.lyrics").click(),
		);
		expect(order(container)[0]).toBe("ribbonBar.previewMode.lyrics");
		expect(
			button("ribbonCustomize.unpin:ribbonBar.previewMode.lyrics").getAttribute(
				"aria-pressed",
			),
		).toBe("true");

		const reset = Array.from(document.querySelectorAll("button")).find(
			(node) => node.textContent === "ribbonCustomize.reset",
		);
		expect(reset?.disabled).toBe(false);
		act(() => reset?.click());
		expect(order(container)).toEqual(TODAY);
	});
});
