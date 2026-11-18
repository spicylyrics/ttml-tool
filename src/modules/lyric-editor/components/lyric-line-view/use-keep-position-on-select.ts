import { type RefObject, useCallback, useLayoutEffect, useRef } from "react";

const PRESS_MEMORY_MS = 600;

const scrollParentOf = (el: HTMLElement): HTMLElement | null => {
	for (let p = el.parentElement; p; p = p.parentElement) {
		const { overflowY } = getComputedStyle(p);
		// A row's own horizontal scroller also reports overflow-y: auto.
		if (
			(overflowY === "auto" || overflowY === "scroll") &&
			p.scrollHeight > p.clientHeight
		)
			return p;
	}
	return null;
};

/**
 * Selecting a line adds its Translation and Romanization rows and collapses
 * the ones above, so the line under the cursor slides away between a click
 * and the double-click or right-click that follows. Remember where the line
 * was when it was pressed and, once the layout settles, scroll by however far
 * it moved.
 */
export const useKeepPositionOnSelect = (
	rowRef: RefObject<HTMLElement | null>,
	selected: boolean,
	active: boolean,
) => {
	const pressedTop = useRef<number | null>(null);
	const forget = useRef<number | undefined>(undefined);

	const rememberPress = useCallback(() => {
		const row = rowRef.current;
		if (!row) return;
		pressedTop.current = row.getBoundingClientRect().top;
		window.clearTimeout(forget.current);
		// A press that doesn't change the selection must not steer a later one.
		forget.current = window.setTimeout(() => {
			pressedTop.current = null;
		}, PRESS_MEMORY_MS);
	}, [rowRef]);

	useLayoutEffect(() => {
		if (!selected || !active) return;
		const before = pressedTop.current;
		pressedTop.current = null;
		const row = rowRef.current;
		if (before === null || !row) return;
		const scroller = scrollParentOf(row);
		const delta = row.getBoundingClientRect().top - before;
		if (scroller && Math.abs(delta) >= 0.5) scroller.scrollTop += delta;
	}, [selected, active, rowRef]);

	return rememberPress;
};
