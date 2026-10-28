import { useAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { createContext, useCallback, useContext, useMemo } from "react";
import { RIBBON_SECTION_CATALOG, type RibbonMode } from "./catalog";
import { defaultLayout, normalizeLayout, type RibbonLayout } from "./layout";

export const RIBBON_CUSTOMIZE_FLAG_KEY = "ribbonCustomizeEnabled";
export const RIBBON_LAYOUTS_KEY = "ribbonLayouts";

/** Feature flag: the Customize button and saved layouts. Off by default. */
export const ribbonCustomizeEnabledAtom = atomWithStorage(
	RIBBON_CUSTOMIZE_FLAG_KEY,
	false,
	undefined,
	{ getOnInit: true },
);

/**
 * Saved layouts per ribbon. A ribbon without an entry uses the default
 * layout, so Reset just removes the entry. Settings backups carry this key.
 */
export const ribbonLayoutsAtom = atomWithStorage<
	Partial<Record<RibbonMode, unknown>>
>(RIBBON_LAYOUTS_KEY, {}, undefined, { getOnInit: true });

/** Which ribbon a frame belongs to, set where the ribbons are mounted. */
export const RibbonModeContext = createContext<RibbonMode | null>(null);

export const useRibbonMode = () => useContext(RibbonModeContext);

export function useRibbonLayout(mode: RibbonMode) {
	const [layouts, setLayouts] = useAtom(ribbonLayoutsAtom);
	const catalog = RIBBON_SECTION_CATALOG[mode];
	const stored = layouts?.[mode];
	const layout = useMemo(
		() =>
			stored === undefined
				? defaultLayout(catalog)
				: normalizeLayout(stored, catalog),
		[stored, catalog],
	);
	const setLayout = useCallback(
		(update: (layout: RibbonLayout) => RibbonLayout) =>
			setLayouts((prev) => {
				const current = normalizeLayout(prev?.[mode], catalog);
				return { ...prev, [mode]: update(current) };
			}),
		[setLayouts, mode, catalog],
	);
	const resetLayout = useCallback(
		() =>
			setLayouts((prev) => {
				const next = { ...prev };
				delete next[mode];
				return next;
			}),
		[setLayouts, mode],
	);
	return { catalog, layout, setLayout, resetLayout };
}
