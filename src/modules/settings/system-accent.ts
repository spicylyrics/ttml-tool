import { atom, useSetAtom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { useEffect } from "react";

/**
 * The system accent and the shades to use on each theme (Windows has its own
 * control shades; macOS and Linux give one color for both).
 */
export interface SystemAccent {
	accent: string;
	onDark: string;
	onLight: string;
}

/** "Follow the system accent" in Preferences › Appearance. Off by default. */
export const useSystemAccentAtom = atomWithStorage<boolean>(
	"useSystemAccent",
	false,
);

/**
 * The current system accent; null on the website, on Linux desktops without
 * one, or after a read error.
 */
export const systemAccentAtom = atom<SystemAccent | null>(null);

/**
 * The hex color that replaces the built-in accent, or null to keep it.
 * A custom accent wins, since someone who picked one by hand means it.
 */
export function resolveAccentOverride({
	useCustomAccent,
	customAccentColor,
	useSystemAccent,
	systemAccent,
	dark,
}: {
	useCustomAccent: boolean;
	customAccentColor: string;
	useSystemAccent: boolean;
	systemAccent: SystemAccent | null;
	dark: boolean;
}): string | null {
	if (useCustomAccent) return customAccentColor;
	if (useSystemAccent && systemAccent)
		return dark ? systemAccent.onDark : systemAccent.onLight;
	return null;
}

const sameAccent = (a: SystemAccent | null, b: SystemAccent | null) =>
	a?.accent === b?.accent &&
	a?.onDark === b?.onDark &&
	a?.onLight === b?.onLight;

/** Reads the system accent once and keeps it current while the app runs. */
export function useSystemAccentWatcher() {
	const setSystemAccent = useSetAtom(systemAccentAtom);
	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) return;
		let disposed = false;
		let unlisten: (() => void) | undefined;
		// Windows and macOS fire for any system color change, often several
		// times per change; skip repeats of the same accent.
		const update = (next: SystemAccent | null) =>
			setSystemAccent((previous) =>
				sameAccent(previous, next) ? previous : next,
			);
		void (async () => {
			const [{ invoke }, { listen }] = await Promise.all([
				import("@tauri-apps/api/core"),
				import("@tauri-apps/api/event"),
			]);
			// Null when the desktop drops its accent (Linux).
			const stop = await listen<SystemAccent | null>(
				"system-accent-changed",
				(event) => update(event.payload),
			);
			if (disposed) stop();
			else unlisten = stop;
			update(
				await invoke<SystemAccent | null>("system_accent").catch(() => null),
			);
		})();
		return () => {
			disposed = true;
			unlisten?.();
		};
	}, [setSystemAccent]);
}
