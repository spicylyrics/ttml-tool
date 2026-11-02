import { useAtomValue } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useEffect, useState } from "react";
import { guessLayout, type KeyboardLayoutId } from "./layouts";

export type KeyboardLayoutChoice = "auto" | KeyboardLayoutId;

export const keyboardViewLayoutAtom = atomWithStorage<KeyboardLayoutChoice>(
	"keyboardView.layout",
	"auto",
);

interface LayoutMapKeyboard {
	getLayoutMap(): Promise<ReadonlyMap<string, string>>;
}

function layoutMapKeyboard(): LayoutMapKeyboard | undefined {
	if (typeof navigator === "undefined") return undefined;
	const keyboard = (navigator as { keyboard?: Partial<LayoutMapKeyboard> })
		.keyboard;
	return typeof keyboard?.getLayoutMap === "function"
		? (keyboard as LayoutMapKeyboard)
		: undefined;
}

export interface KeyboardLayoutInfo {
	/** The layout whose shape and fallback labels the view uses. */
	layout: KeyboardLayoutId;
	/** What the browser reported, when it can (Chromium and WebView2). */
	detected?: KeyboardLayoutId;
	/** Whether layout detection is available at all. */
	canDetect: boolean;
	/** Printed characters by `KeyboardEvent.code`, from the browser. */
	labels?: ReadonlyMap<string, string>;
}

export function useKeyboardLayout(): KeyboardLayoutInfo {
	const choice = useAtomValue(keyboardViewLayoutAtom);
	const [labels, setLabels] = useState<ReadonlyMap<string, string>>();
	const keyboard = layoutMapKeyboard();
	useEffect(() => {
		if (!keyboard) return;
		let cancelled = false;
		keyboard
			.getLayoutMap()
			.then((map) => {
				if (!cancelled) setLabels(map);
			})
			// Blocked in some frames and permission policies; fall back quietly.
			.catch(() => {});
		return () => {
			cancelled = true;
		};
	}, [keyboard]);
	const detected = labels ? guessLayout(labels) : undefined;
	if (choice !== "auto")
		return { layout: choice, detected, canDetect: !!keyboard };
	return {
		layout: detected ?? "qwerty",
		detected,
		canDetect: !!keyboard,
		labels,
	};
}
