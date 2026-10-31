import { type Atom, atom, type createStore, useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { type DependencyList, useEffect } from "react";
import { warn } from "./logging.ts";

export type KeyBindingsConfig = string[];
export interface KeyBindingEvent {
	downTime: number;
	downTimeOffset: number;
	triggerTime: number;
}
export type KeyBindingCallback = (evt: KeyBindingEvent) => void;

/**
 * 触发模式枚举
 */
export enum KeyBindingTriggerMode {
	KeyDown = "keydown",
	KeyUp = "keyup",
}

/**
 * 用于在事件监听器中快速读取当前模式
 */
let currentTriggerMode: KeyBindingTriggerMode = KeyBindingTriggerMode.KeyDown;

// TODO: 把这个组件变成 hook 这样就可以直接读取 atom 而不是手动解析 localStorage 了
if (typeof localStorage !== "undefined") {
	const raw = localStorage.getItem("keyBindingTriggerMode");
	if (raw) {
		try {
			const parsed = JSON.parse(raw);
			currentTriggerMode = parsed as KeyBindingTriggerMode;
		} catch {
			currentTriggerMode = raw as KeyBindingTriggerMode;
		}
	}
}

if (
	currentTriggerMode !== KeyBindingTriggerMode.KeyDown &&
	currentTriggerMode !== KeyBindingTriggerMode.KeyUp
) {
	currentTriggerMode = KeyBindingTriggerMode.KeyDown;
}

const internalTriggerModeAtom = atomWithStorage<KeyBindingTriggerMode>(
	"keyBindingTriggerMode",
	currentTriggerMode,
	undefined,
	{ getOnInit: true },
);

export const keyBindingTriggerModeAtom = atom(
	(get) => get(internalTriggerModeAtom),
	(_get, set, newValue: KeyBindingTriggerMode) => {
		set(internalTriggerModeAtom, newValue);
		currentTriggerMode = newValue;
	},
);

// Display names for KeyboardEvent.code values that don't read as typed.
const KEY_LABELS: Record<string, string> = {
	ArrowLeft: "←",
	ArrowRight: "→",
	ArrowUp: "↑",
	ArrowDown: "↓",
	BracketLeft: "[",
	BracketRight: "]",
	Backquote: "`",
	Backslash: "\\",
	IntlBackslash: "\\",
	Comma: ",",
	Equal: "=",
	Minus: "-",
	Period: ".",
	Quote: "'",
	Semicolon: ";",
	Slash: "/",
	Escape: "Esc",
	PageUp: "Page Up",
	PageDown: "Page Down",
	NumpadAdd: "Num +",
	NumpadSubtract: "Num -",
	NumpadMultiply: "Num *",
	NumpadDivide: "Num /",
	NumpadDecimal: "Num .",
	NumpadEqual: "Num =",
	NumpadEnter: "Num Enter",
};

function formatKeyName(key: string): string {
	const label = KEY_LABELS[key];
	if (label) return label;
	const match = /^(?:Key([A-Z])|Digit(\d)|Numpad(\d))$/.exec(key);
	if (match) return match[1] ?? match[2] ?? `Num ${match[3]}`;
	return key;
}

/** Display text such as "Ctrl+Shift+2", or "⌃⇧2" on macOS. Display only. */
export function formatKeyBindings(cfg: KeyBindingsConfig): string {
	return formatKeyBindingsAsArray(cfg).join(
		navigator.userAgent.includes("Mac") ? "" : "+",
	);
}

export function formatKeyBindingsAsArray(cfg: KeyBindingsConfig): string[] {
	const sorted = normalizeKeyBindings(cfg).sort((a, b) => {
		const indexA = MODIFIER_ORDER.indexOf(a);
		const indexB = MODIFIER_ORDER.indexOf(b);
		if (indexA !== -1 && indexB !== -1) return indexA - indexB;
		if (indexA !== -1) return -1;
		if (indexB !== -1) return 1;
		return a.localeCompare(b);
	});
	return sorted.map((key) => {
		if (navigator.userAgent.includes("Mac")) {
			if (key === "Control") return "⌃";
			if (key === "Alt") return "⌥";
			if (key === "Shift") return "⇧";
			if (key === "Meta") return "⌘";
		} else {
			if (key === "Control") return "Ctrl";
			if (key === "Meta" && navigator.userAgent.includes("Windows"))
				return "Win";
		}
		return formatKeyName(key);
	});
}

export const RESET_KEYBINDING = Symbol("reset-keybinding");

export function atomWithKeybindingStorage(
	storageName: string,
	defaultValue: KeyBindingsConfig,
) {
	const key = `keybindings:${storageName}`;
	const keyAtom = atomWithStorage(key, defaultValue);
	return atom(
		(get) => get(keyAtom),
		async (_get, set, update?: KeyBindingsConfig | typeof RESET_KEYBINDING) => {
			if (update) {
				if (update === RESET_KEYBINDING) set(keyAtom, defaultValue);
				else set(keyAtom, update);
			} else {
				try {
					set(keyAtom, await recordShortcut());
				} catch {
					// Canceling recording leaves the current binding intact.
				}
			}
		},
	);
}

export function normalizeKeyCode(code: string): string {
	if (code === "KeyHome") return "Home";
	if (code === "KeyEnd") return "End";
	return code.replace(/^(Control|Meta|Alt|Shift)(Left|Right)$/, "$1");
}

/**
 * The binding key an event presses. Letters A-Z follow the character the
 * layout types, so Ctrl+Z is the key printed Z on QWERTZ, AZERTY or Dvorak.
 * Every other key keeps its physical position: digits and punctuation move
 * between layouts, dead keys type nothing, and macOS Option or AltGr turn
 * letters into other characters (Option+C types ç), so matching their
 * characters would leave defaults unreachable. Non-Latin layouts stay
 * physical too, since their letters are not A-Z.
 */
export function shortcutKeyFromEvent(
	event: Pick<KeyboardEvent, "code" | "key">,
): string {
	if (/^[a-z]$/i.test(event.key)) return `Key${event.key.toUpperCase()}`;
	return normalizeKeyCode(event.code);
}

export function normalizeKeyBindings(cfg: Iterable<string>): KeyBindingsConfig {
	return [...new Set([...cfg].map(normalizeKeyCode))];
}

const pressingKeys = new Set<string>();
const registeredKeyBindings = new Map<string, Set<KeyBindingCallback>>();
const registeredAtomBindings = new Map<
	ReturnType<typeof atomWithKeybindingStorage>,
	Set<KeyBindingCallback>
>();
let downTime = 0;

const MODIFIER_ORDER = ["Control", "Meta", "Alt", "Shift"];
export function getShortcutKey(cfg: KeyBindingsConfig | Set<string>) {
	const keys = normalizeKeyBindings(cfg);
	keys.sort((a, b) => {
		const indexA = MODIFIER_ORDER.indexOf(a);
		const indexB = MODIFIER_ORDER.indexOf(b);
		if (indexA !== -1 && indexB !== -1) return indexA - indexB;
		if (indexA !== -1) return -1;
		if (indexB !== -1) return 1;
		return a.localeCompare(b);
	});
	return keys.join(" + ");
}

const keyDownTimes = new Map<string, number>();
const heldKeyCodes = new Map<string, string>();

function clearPressingKeys() {
	pressingKeys.clear();
	keyDownTimes.clear();
	heldKeyCodes.clear();
}

/**
 * Fast syncing rolls keys: G goes down before H comes up. The held H would turn
 * the press into an unbound "G + H" and drop it, so fall back to the pressed key
 * with only the held modifiers.
 */
function dispatchPressingKeys(code: string, evt: KeyboardEvent) {
	const joined = getShortcutKey(pressingKeys);
	if (registeredKeyBindings.has(joined) || MODIFIER_ORDER.includes(code)) {
		triggerCallbacks(joined, evt, downTime);
		return;
	}
	const modifiers = [...pressingKeys].filter((key) =>
		MODIFIER_ORDER.includes(key),
	);
	triggerCallbacks(
		getShortcutKey([...modifiers, code]),
		evt,
		keyDownTimes.get(code) ?? evt.timeStamp,
	);
}

function triggerCallbacks(
	joinedKey: string,
	evt: KeyboardEvent,
	targetTime: number,
) {
	const callbacks = registeredKeyBindings.get(joinedKey);
	if (callbacks) {
		const downTimeOffset = evt.timeStamp - targetTime;
		const e: KeyBindingEvent = {
			downTime: targetTime,
			downTimeOffset,
			triggerTime: evt.timeStamp,
		};
		for (const cb of callbacks) {
			try {
				cb(e);
			} catch (err) {
				warn("Error in key binding ", joinedKey, "callback", err);
			}
		}
		evt.preventDefault();
		evt.stopPropagation();
		evt.stopImmediatePropagation();
	}
}

window.addEventListener("keydown", (evt) => {
	// IME keystrokes belong to the composition, not to shortcuts.
	if (evt.repeat || evt.isComposing || evt.key === "Process") return;
	if (isEditing(evt)) {
		clearPressingKeys();
		return;
	}
	if (pressingKeys.size === 0) {
		downTime = evt.timeStamp;
	}

	const code = shortcutKeyFromEvent(evt);
	heldKeyCodes.set(evt.code, code);
	keyDownTimes.set(code, evt.timeStamp);

	// 阻止空格滚动
	if (
		(evt.code === "Space" || evt.code === "Home" || evt.code === "End") &&
		evt.target === document.body
	) {
		evt.preventDefault();
		evt.stopPropagation();
	}

	pressingKeys.add(code);

	if (currentTriggerMode === KeyBindingTriggerMode.KeyDown) {
		dispatchPressingKeys(code, evt);
	}
});

window.addEventListener("keyup", (evt) => {
	if (isEditing(evt)) {
		clearPressingKeys();
		return;
	}
	if (!heldKeyCodes.has(evt.code)) return;

	const code = heldKeyCodes.get(evt.code) ?? shortcutKeyFromEvent(evt);

	if (currentTriggerMode === KeyBindingTriggerMode.KeyUp) {
		dispatchPressingKeys(code, evt);
	}

	pressingKeys.delete(code);
	keyDownTimes.delete(code);
	heldKeyCodes.delete(evt.code);
});
window.addEventListener("blur", clearPressingKeys);
window.addEventListener("focus", clearPressingKeys);

export function forceInvokeKeyBindingAtom(
	store: ReturnType<typeof createStore>,
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
	evt?: MouseEvent | KeyboardEvent | TouchEvent,
) {
	const keyBinding = store.get(thisAtom);
	const joined = getShortcutKey(keyBinding);
	const callbacks = registeredAtomBindings.get(thisAtom);

	if (callbacks) {
		const downTimeOffset = 0;
		const eventTime = evt?.timeStamp ?? performance.now();

		const e: KeyBindingEvent = {
			downTime: eventTime,
			downTimeOffset,
			triggerTime: eventTime,
		};
		for (const cb of callbacks) {
			try {
				cb(e);
			} catch (err) {
				warn("Error in key binding ", joined, "callback", err);
			}
		}
		evt?.preventDefault();
		evt?.stopPropagation();
		evt?.stopImmediatePropagation();
	}
}

// From https://wangchujiang.com/hotkeys-js/
export function isEditing(event: KeyboardEvent | MouseEvent) {
	const checkElement = (target: HTMLElement | null) => {
		const tagName = target?.tagName;
		return (
			target?.isContentEditable ||
			tagName === "INPUT" ||
			tagName === "SELECT" ||
			tagName === "TEXTAREA" ||
			// A focused slider owns the arrow, Home/End and Page keys.
			target?.getAttribute?.("role") === "slider" ||
			!!currentKeyDownEvent ||
			!!currentKeyUpEvent
		);
	};
	return (
		checkElement((event.target || event.srcElement) as HTMLElement | null) ||
		checkElement(document.activeElement as HTMLElement | null)
	);
}

export function isInteracting(event: KeyboardEvent | MouseEvent) {
	const checkElement = (target: HTMLElement | null) => {
		const tagName = target?.tagName;
		return (
			target?.isContentEditable ||
			tagName === "INPUT" ||
			tagName === "SELECT" ||
			tagName === "TEXTAREA" ||
			tagName === "BUTTON" ||
			!!currentKeyDownEvent ||
			!!currentKeyUpEvent
		);
	};
	return (
		checkElement((event.target || event.srcElement) as HTMLElement | null) ||
		checkElement(document.activeElement as HTMLElement | null)
	);
}

export function registerKeyBindings(
	cfg: KeyBindingsConfig,
	callback: KeyBindingCallback,
) {
	if (cfg.length === 0) {
		return () => {};
	}
	const joined = getShortcutKey(cfg);
	let set = registeredKeyBindings.get(joined);
	if (!set) {
		set = new Set();
		registeredKeyBindings.set(joined, set);
	}
	set.add(callback);
	return () => {
		set?.delete(callback);
		if (set?.size === 0) registeredKeyBindings.delete(joined);
	};
}

export function useKeyBinding(
	cfg: KeyBindingsConfig,
	callback: KeyBindingCallback,
	deps?: DependencyList,
) {
	useEffect(() => {
		return registerKeyBindings(cfg, callback);
	}, [cfg, callback, ...(deps || [])]);
}

/**
 * Registers an action's shortcut. With `doublePress`, the shortcut only runs it
 * on a second press in quick succession; the callback on the atom (used by the
 * command palette and on-screen controls) still runs it at once.
 */
export function registerKeyBindingAtom(
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
	cfg: KeyBindingsConfig,
	callback: KeyBindingCallback,
	doublePress = false,
) {
	// On-screen timing controls invoke an action even when its shortcut is unbound.
	let callbacks = registeredAtomBindings.get(thisAtom);
	if (!callbacks) {
		callbacks = new Set();
		registeredAtomBindings.set(thisAtom, callbacks);
	}
	callbacks.add(callback);
	const unregisterShortcut = (
		doublePress ? registerDoubleKeyBindings : registerKeyBindings
	)(cfg, callback);
	return () => {
		unregisterShortcut();
		callbacks?.delete(callback);
		if (callbacks?.size === 0) registeredAtomBindings.delete(thisAtom);
	};
}

/**
 * Extra shortcuts for an action beyond its stored primary binding. The keyboard
 * module installs the resolver; without it there are no extras.
 */
type ExtraKeyBindingsResolver = (
	binding: ReturnType<typeof atomWithKeybindingStorage>,
) => Atom<KeyBindingsConfig[]> | undefined;
let extraKeyBindingsResolver: ExtraKeyBindingsResolver | undefined;
const NO_EXTRA_KEY_BINDINGS = atom<KeyBindingsConfig[]>([]);

export function setExtraKeyBindingsResolver(
	resolver: ExtraKeyBindingsResolver | undefined,
) {
	extraKeyBindingsResolver = resolver;
}

export function useExtraKeyBindings(
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
): KeyBindingsConfig[] {
	return useAtomValue(
		extraKeyBindingsResolver?.(thisAtom) ?? NO_EXTRA_KEY_BINDINGS,
	);
}

/**
 * Whether an action is set to "Press twice to run". The keyboard module
 * installs the resolver; without it every action runs on one press.
 */
type DoublePressResolver = (
	binding: ReturnType<typeof atomWithKeybindingStorage>,
) => Atom<boolean> | undefined;
let doublePressResolver: DoublePressResolver | undefined;
const SINGLE_PRESS = atom(false);

export function setDoublePressResolver(
	resolver: DoublePressResolver | undefined,
) {
	doublePressResolver = resolver;
}

export function useDoublePress(
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
): boolean {
	return useAtomValue(doublePressResolver?.(thisAtom) ?? SINGLE_PRESS);
}

/** Registers each extra shortcut once, skipping any that repeat the primary. */
export function registerExtraKeyBindings(
	primary: KeyBindingsConfig,
	extras: readonly KeyBindingsConfig[],
	callback: KeyBindingCallback,
	doublePress = false,
) {
	const register = doublePress
		? registerDoubleKeyBindings
		: registerKeyBindings;
	const seen = new Set([getShortcutKey(primary)]);
	const unregister: Array<() => void> = [];
	for (const extra of extras) {
		const joined = getShortcutKey(extra);
		if (extra.length === 0 || seen.has(joined)) continue;
		seen.add(joined);
		unregister.push(register(extra, callback));
	}
	return () => {
		for (const fn of unregister) fn();
	};
}

/**
 * @deprecated 请使用 useCommand
 */
export function useKeyBindingAtom(
	thisAtom: ReturnType<typeof atomWithKeybindingStorage>,
	callback: KeyBindingCallback,
	deps?: DependencyList,
): KeyBindingsConfig {
	const keyBindings = useAtomValue(thisAtom);
	const extraKeyBindings = useExtraKeyBindings(thisAtom);
	const doublePress = useDoublePress(thisAtom);
	useEffect(() => {
		const unregister = registerKeyBindingAtom(
			thisAtom,
			keyBindings,
			callback,
			doublePress,
		);
		const unregisterExtras = registerExtraKeyBindings(
			keyBindings,
			extraKeyBindings,
			callback,
			doublePress,
		);
		return () => {
			unregister();
			unregisterExtras();
		};
	}, [
		thisAtom,
		keyBindings,
		extraKeyBindings,
		callback,
		doublePress,
		...(deps || []),
	]);
	return keyBindings;
}

/** How quickly the second press must follow for "Press twice to run". */
export const DOUBLE_PRESS_WINDOW_MS = 350;

export function registerDoubleKeyBindings(
	cfg: KeyBindingsConfig,
	callback: KeyBindingCallback,
) {
	if (cfg.length === 0) return () => {};
	let lastPressTime = -Infinity;
	let pending: { code: string; downTime: number } | undefined;
	const joinedKey = getShortcutKey(cfg);
	const reset = () => {
		lastPressTime = -Infinity;
		pending = undefined;
	};
	const trigger = (evt: KeyboardEvent, keyDownTime: number) => {
		if (evt.timeStamp - lastPressTime <= DOUBLE_PRESS_WINDOW_MS) {
			callback({
				downTime: keyDownTime,
				downTimeOffset: evt.timeStamp - keyDownTime,
				triggerTime: evt.timeStamp,
			});
			// This capture listener consumes the event before the dispatcher sees it.
			if (evt.type === "keyup") {
				const code = heldKeyCodes.get(evt.code) ?? shortcutKeyFromEvent(evt);
				pressingKeys.delete(code);
				keyDownTimes.delete(code);
				heldKeyCodes.delete(evt.code);
			}
			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();
			lastPressTime = -Infinity;
		} else {
			lastPressTime = evt.timeStamp;
		}
	};
	const onKeyDown = (evt: KeyboardEvent) => {
		if (isEditing(evt)) {
			reset();
			return;
		}
		if (evt.repeat || evt.isComposing || evt.key === "Process") return;
		const keys = [
			...(evt.ctrlKey ? ["Control"] : []),
			...(evt.metaKey ? ["Meta"] : []),
			...(evt.altKey ? ["Alt"] : []),
			...(evt.shiftKey ? ["Shift"] : []),
			shortcutKeyFromEvent(evt),
		];
		if (getShortcutKey(keys) !== joinedKey) {
			const code = shortcutKeyFromEvent(evt);
			if (
				MODIFIER_ORDER.includes(code) &&
				normalizeKeyBindings(cfg).includes(code)
			)
				return;
			reset();
			return;
		}
		if (currentTriggerMode === KeyBindingTriggerMode.KeyDown) {
			trigger(evt, evt.timeStamp);
		} else {
			pending = { code: evt.code, downTime: evt.timeStamp };
		}
	};
	const onKeyUp = (evt: KeyboardEvent) => {
		if (isEditing(evt)) {
			reset();
			return;
		}
		if (pending?.code !== evt.code) return;
		if (currentTriggerMode === KeyBindingTriggerMode.KeyUp) {
			trigger(evt, pending.downTime);
		}
		pending = undefined;
	};
	window.addEventListener("keydown", onKeyDown, { capture: true });
	window.addEventListener("keyup", onKeyUp, { capture: true });
	window.addEventListener("blur", reset);
	return () => {
		window.removeEventListener("keydown", onKeyDown, { capture: true });
		window.removeEventListener("keyup", onKeyUp, { capture: true });
		window.removeEventListener("blur", reset);
	};
}

let currentKeyDownEvent: ((evt: KeyboardEvent) => void) | undefined;
let currentKeyUpEvent: ((evt: KeyboardEvent) => void) | undefined;
let currentRecordingReject: ((reason: Error) => void) | undefined;

export function stopRecordingShortcut() {
	if (currentKeyDownEvent) {
		window.removeEventListener("keydown", currentKeyDownEvent, {
			capture: true,
		});
		currentKeyDownEvent = undefined;
	}
	if (currentKeyUpEvent) {
		window.removeEventListener("keyup", currentKeyUpEvent, { capture: true });
		currentKeyUpEvent = undefined;
	}
	clearPressingKeys();
	currentRecordingReject?.(new Error("User canceled"));
	currentRecordingReject = undefined;
}

export function recordShortcut(): Promise<KeyBindingsConfig> {
	return new Promise((resolve, reject) => {
		stopRecordingShortcut();
		const recorded = new Set<string>();
		const stack = new Set<string>();
		const onKeyDown = (evt: KeyboardEvent) => {
			if (evt.isComposing || evt.key === "Process") return;
			recorded.add(shortcutKeyFromEvent(evt));
			stack.add(evt.code);
			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();
		};
		const onKeyUp = (evt: KeyboardEvent) => {
			if (!stack.has(evt.code)) return;
			stack.delete(evt.code);
			if (stack.size === 0) {
				currentRecordingReject = undefined;
				stopRecordingShortcut();
				if (recorded.size === 1 && recorded.has("Escape")) {
					reject(new Error("User canceled"));
				} else {
					resolve([...recorded]);
				}
			}
			evt.preventDefault();
			evt.stopPropagation();
			evt.stopImmediatePropagation();
		};
		currentKeyDownEvent = onKeyDown;
		currentKeyUpEvent = onKeyUp;
		currentRecordingReject = reject;
		// Capture before dialog Escape handlers so canceling keeps Preferences open.
		window.addEventListener("keydown", onKeyDown, { capture: true });
		window.addEventListener("keyup", onKeyUp, { capture: true });
	});
}
