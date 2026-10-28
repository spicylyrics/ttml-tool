// @vitest-environment jsdom
import { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, describe, expect, it, vi } from "vitest";
import { newLyricLine, newLyricWord } from "$/types/ttml";
import { buildSpicyLines, type SpicyWordProblems } from "./model";
import { SpicyLyricLines } from "./SpicyLyricLines";

const render = async (problems?: SpicyWordProblems) => {
	vi.stubGlobal("IS_REACT_ACT_ENVIRONMENT", true);
	const line = newLyricLine();
	line.startTime = 1_000;
	line.endTime = 2_000;
	line.words = [
		{ ...newLyricWord(), id: "ok", word: "Fine ", startTime: 1_000 },
		{ ...newLyricWord(), id: "early", word: "early", startTime: 900 },
	];
	line.words[0].endTime = 1_400;
	line.words[1].endTime = 1_500;
	const lines = buildSpicyLines([line], false, false, false, false, problems);
	const container = document.createElement("div");
	const root = createRoot(container);
	await act(async () =>
		root.render(
			<SpicyLyricLines
				lines={lines}
				rows={lines.map((_, index) => ({ index, start: 0 }))}
				totalSize={100}
				measureRow={() => {}}
				lineNodes={{ current: new Map() }}
				wordNodes={{ current: new Map() }}
				showTranslation={false}
				seek={() => {}}
			/>,
		),
	);
	return { container, root };
};

afterEach(() => vi.unstubAllGlobals());

describe("Spicy preview timing problem marks", () => {
	it("adds no marks or labels without problems", async () => {
		const { container, root } = await render();
		expect(container.querySelector("[data-timing-problem]")).toBeNull();
		expect(container.querySelector("[title]")).toBeNull();
		expect(container.querySelector("[aria-label]")).toBeNull();
		await act(async () => root.unmount());
	});

	it("marks a flagged word with its problem as tooltip and label", async () => {
		const { container, root } = await render(
			new Map([["early", ["startsBeforeLine"]]]),
		);
		const marked = container.querySelectorAll("[data-timing-problem]");
		expect(marked).toHaveLength(1);
		expect(marked[0].textContent).toBe("early");
		expect(marked[0].getAttribute("data-timing-problem")).toBe(
			"startsBeforeLine",
		);
		expect(marked[0].getAttribute("title")).toBe("Starts before its line");
		expect(marked[0].getAttribute("aria-label")).toBe(
			"early: Starts before its line",
		);
		await act(async () => root.unmount());
	});
});
