import { useAtomValue } from "jotai";
import { lazy } from "$/utils/lazy.ts";
import { preferencesShellEnabledAtom } from "./states";

// Each look is its own chunk, so only the one in use is fetched.
const PreferencesShell = lazy(() =>
	import("./PreferencesShell").then((m) => ({ default: m.PreferencesShell })),
);
const SettingsDialog = lazy(() =>
	import("../modals/index.tsx").then((m) => ({ default: m.SettingsDialog })),
);

/** Preferences: the new shell behind its flag, the classic dialog otherwise. */
export const PreferencesDialog = () =>
	useAtomValue(preferencesShellEnabledAtom) ? (
		<PreferencesShell />
	) : (
		<SettingsDialog />
	);
