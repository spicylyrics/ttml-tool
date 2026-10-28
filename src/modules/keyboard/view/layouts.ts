/**
 * Physical keyboard geometry for the keyboard view. Keys are identified by
 * `KeyboardEvent.code`, which names a physical position, so bindings stay put
 * whatever the user's layout. Only the printed labels change per layout.
 */

export type KeyboardLayoutId = "qwerty" | "azerty" | "qwertz";
export type KeyboardGeometry = "ansi" | "iso";

export interface KeyCap {
	/** `KeyboardEvent.code`, normalized like bindings (`ShiftLeft` → `Shift`). */
	code: string;
	/** Width in key units. */
	width?: number;
	/** A second piece of a key shown twice (the ISO Enter), not focusable. */
	continuation?: boolean;
}

/** A blank gap of the given width. */
export interface KeyGap {
	gap: number;
}

export type KeyRowItem = KeyCap | KeyGap;

export function isGap(item: KeyRowItem): item is KeyGap {
	return "gap" in item;
}

const keys = (codes: string[]): KeyCap[] => codes.map((code) => ({ code }));
const letters = (chars: string) => keys([...chars].map((char) => `Key${char}`));

const FUNCTION_ROW: KeyRowItem[] = [
	{ code: "Escape" },
	{ gap: 1 },
	...keys(["F1", "F2", "F3", "F4"]),
	{ gap: 0.5 },
	...keys(["F5", "F6", "F7", "F8"]),
	{ gap: 0.5 },
	...keys(["F9", "F10", "F11", "F12"]),
];

const NUMBER_ROW: KeyRowItem[] = [
	{ code: "Backquote" },
	...keys([..."1234567890"].map((digit) => `Digit${digit}`)),
	...keys(["Minus", "Equal"]),
	{ code: "Backspace", width: 2 },
];

const BOTTOM_ROW: KeyRowItem[] = [
	{ code: "Control", width: 1.25 },
	{ code: "Meta", width: 1.25 },
	{ code: "Alt", width: 1.25 },
	{ code: "Space", width: 6.25 },
	{ code: "Alt", width: 1.25 },
	{ code: "Meta", width: 1.25 },
	{ code: "ContextMenu", width: 1.25 },
	{ code: "Control", width: 1.25 },
];

const ANSI_ROWS: KeyRowItem[][] = [
	FUNCTION_ROW,
	NUMBER_ROW,
	[
		{ code: "Tab", width: 1.5 },
		...letters("QWERTYUIOP"),
		...keys(["BracketLeft", "BracketRight"]),
		{ code: "Backslash", width: 1.5 },
	],
	[
		{ code: "CapsLock", width: 1.75 },
		...letters("ASDFGHJKL"),
		...keys(["Semicolon", "Quote"]),
		{ code: "Enter", width: 2.25 },
	],
	[
		{ code: "Shift", width: 2.25 },
		...letters("ZXCVBNM"),
		...keys(["Comma", "Period", "Slash"]),
		{ code: "Shift", width: 2.75 },
	],
	BOTTOM_ROW,
];

const ISO_ROWS: KeyRowItem[][] = [
	FUNCTION_ROW,
	NUMBER_ROW,
	[
		{ code: "Tab", width: 1.5 },
		...letters("QWERTYUIOP"),
		...keys(["BracketLeft", "BracketRight"]),
		{ code: "Enter", width: 1.5 },
	],
	[
		{ code: "CapsLock", width: 1.75 },
		...letters("ASDFGHJKL"),
		...keys(["Semicolon", "Quote", "Backslash"]),
		{ code: "Enter", width: 1.25, continuation: true },
	],
	[
		{ code: "Shift", width: 1.25 },
		{ code: "IntlBackslash" },
		...letters("ZXCVBNM"),
		...keys(["Comma", "Period", "Slash"]),
		{ code: "Shift", width: 2.75 },
	],
	BOTTOM_ROW,
];

/** Navigation and arrow keys, row-aligned with the main block. */
export const NAVIGATION_ROWS: KeyRowItem[][] = [
	[{ gap: 3 }],
	keys(["Insert", "Home", "PageUp"]),
	keys(["Delete", "End", "PageDown"]),
	[{ gap: 3 }],
	[{ gap: 1 }, { code: "ArrowUp" }, { gap: 1 }],
	keys(["ArrowLeft", "ArrowDown", "ArrowRight"]),
];

export function mainRows(geometry: KeyboardGeometry): KeyRowItem[][] {
	return geometry === "iso" ? ISO_ROWS : ANSI_ROWS;
}

export const MODIFIER_CODES = ["Control", "Meta", "Alt", "Shift"] as const;
export type ModifierCode = (typeof MODIFIER_CODES)[number];

export function isModifierCode(code: string): code is ModifierCode {
	return (MODIFIER_CODES as readonly string[]).includes(code);
}

/**
 * Printed labels that differ from QWERTY, for when the browser can't report
 * the layout. Only letters and the keys that move with them are listed.
 */
const LAYOUT_LABELS: Record<KeyboardLayoutId, Record<string, string>> = {
	qwerty: {},
	azerty: {
		KeyQ: "A",
		KeyW: "Z",
		KeyA: "Q",
		KeyZ: "W",
		KeyM: ",",
		Semicolon: "M",
		Comma: ";",
		Period: ":",
		Slash: "!",
		Quote: "ù",
		BracketLeft: "^",
		BracketRight: "$",
		Backslash: "*",
		Backquote: "²",
		IntlBackslash: "<",
		Digit1: "&",
		Digit2: "é",
		Digit3: '"',
		Digit4: "'",
		Digit5: "(",
		Digit6: "-",
		Digit7: "è",
		Digit8: "_",
		Digit9: "ç",
		Digit0: "à",
		Minus: ")",
		Equal: "=",
	},
	qwertz: {
		KeyY: "Z",
		KeyZ: "Y",
		Semicolon: "Ö",
		Quote: "Ä",
		BracketLeft: "Ü",
		BracketRight: "+",
		Backslash: "#",
		Backquote: "^",
		IntlBackslash: "<",
		Minus: "ß",
		Equal: "´",
		Slash: "-",
	},
};

export function layoutLabel(
	layout: KeyboardLayoutId,
	code: string,
): string | undefined {
	return LAYOUT_LABELS[layout][code];
}

export function geometryFor(layout: KeyboardLayoutId): KeyboardGeometry {
	return layout === "qwerty" ? "ansi" : "iso";
}

/**
 * Guesses the family of a layout reported by `navigator.keyboard`, from what
 * the Q, Y and A positions print.
 */
export function guessLayout(
	map: ReadonlyMap<string, string>,
): KeyboardLayoutId {
	const q = map.get("KeyQ")?.toLowerCase();
	const y = map.get("KeyY")?.toLowerCase();
	if (q === "a") return "azerty";
	if (y === "z") return "qwertz";
	return "qwerty";
}
