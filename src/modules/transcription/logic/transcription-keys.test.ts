import { describe, expect, it } from "vitest";
import { transcriptionKeyAction } from "./transcription-keys";

const key = (code: string, mods: Partial<Record<string, boolean>> = {}) => ({
	code,
	altKey: false,
	ctrlKey: false,
	metaKey: false,
	shiftKey: false,
	isComposing: false,
	...mods,
});

describe("transcriptionKeyAction", () => {
	it("maps Esc and the Alt keys", () => {
		expect(transcriptionKeyAction(key("Escape"))).toBe("playPause");
		expect(transcriptionKeyAction(key("KeyK", { altKey: true }))).toBe(
			"playPause",
		);
		expect(transcriptionKeyAction(key("KeyJ", { altKey: true }))).toBe(
			"seekBackward",
		);
		expect(transcriptionKeyAction(key("KeyL", { altKey: true }))).toBe(
			"seekForward",
		);
		expect(transcriptionKeyAction(key("Comma", { altKey: true }))).toBe(
			"slower",
		);
		expect(transcriptionKeyAction(key("Period", { altKey: true }))).toBe(
			"faster",
		);
		expect(transcriptionKeyAction(key("Slash", { altKey: true }))).toBe(
			"resetSpeed",
		);
	});

	it("leaves typing alone", () => {
		expect(transcriptionKeyAction(key("KeyK"))).toBeNull();
		expect(transcriptionKeyAction(key("Space"))).toBeNull();
		expect(transcriptionKeyAction(key("Escape", { altKey: true }))).toBeNull();
	});

	it("ignores AltGr, other modifiers and IME composition", () => {
		expect(
			transcriptionKeyAction(key("KeyL", { altKey: true, ctrlKey: true })),
		).toBeNull();
		expect(
			transcriptionKeyAction(key("KeyL", { altKey: true, metaKey: true })),
		).toBeNull();
		expect(
			transcriptionKeyAction(key("KeyL", { altKey: true, shiftKey: true })),
		).toBeNull();
		expect(
			transcriptionKeyAction(key("Escape", { isComposing: true })),
		).toBeNull();
	});
});
