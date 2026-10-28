import { createContext, type ReactNode, useContext } from "react";

const NONE: ReadonlySet<unknown> = new Set();

/**
 * Settings the new Preferences shell shows somewhere else (the Experimental
 * page), keyed by their atom. The shell provides it around its regular pages;
 * the classic dialog doesn't, so there nothing is hidden.
 */
export const RelocatedSettingsContext =
	createContext<ReadonlySet<unknown>>(NONE);

export function useRelocatedSettings(): ReadonlySet<unknown> {
	return useContext(RelocatedSettingsContext);
}

/** Renders its row unless the shell shows that setting on another page. */
export const Relocatable = ({
	setting,
	children,
}: {
	setting: unknown;
	children: ReactNode;
}) => (useRelocatedSettings().has(setting) ? null : children);
