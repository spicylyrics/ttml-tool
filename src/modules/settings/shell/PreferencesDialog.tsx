import { useAtomValue } from "jotai";
import { SettingsDialog } from "../modals/index.tsx";
import { PreferencesShell } from "./PreferencesShell";
import { preferencesShellEnabledAtom } from "./states";

/** Preferences: the new shell behind its flag, the classic dialog otherwise. */
export const PreferencesDialog = () =>
	useAtomValue(preferencesShellEnabledAtom) ? (
		<PreferencesShell />
	) : (
		<SettingsDialog />
	);
