import { type RefObject, useEffect, useRef } from "react";
import { prefersReducedMotion } from "$/utils/reduced-motion";

/**
 * Briefly lights `ref` when `value` changes, for the "visualize timestamp
 * updates" setting. It flashes only on a real change, not when the row first
 * mounts (a virtualized list mounts rows as they scroll into view), and not
 * when the OS asks for less motion.
 */
export function useFlashOnChange(
	ref: RefObject<HTMLElement | null>,
	value: number,
	enabled: boolean,
) {
	const previous = useRef(value);
	// biome-ignore lint/correctness/useExhaustiveDependencies: ref objects are stable
	useEffect(() => {
		if (previous.current === value) return;
		previous.current = value;
		if (!enabled || prefersReducedMotion()) return;
		const animation = ref.current?.animate(
			[
				{ backgroundColor: "var(--accent-a8)" },
				{ backgroundColor: "var(--accent-a4)" },
			],
			{ duration: 500 },
		);
		return () => animation?.cancel();
	}, [value, enabled]);
}
