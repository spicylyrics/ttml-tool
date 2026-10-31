import { useEffect, useState } from "react";

let customTitleBar: Promise<boolean> | undefined;

/**
 * Whether the Linux app draws its own title bar. The Flatpak does (see
 * uses_custom_title_bar in lib.rs); other Linux installs use the native one.
 */
export function linuxUsesCustomTitleBar(): Promise<boolean> {
	if (import.meta.env.TAURI_ENV_PLATFORM !== "linux") {
		return Promise.resolve(false);
	}
	customTitleBar ??= import("@tauri-apps/api/core")
		.then(({ invoke }) => invoke<boolean>("uses_custom_title_bar"))
		.catch(() => false);
	return customTitleBar;
}

/** Tracks whether the window is maximized while `enabled`. */
export function useWindowMaximized(enabled: boolean): boolean {
	const [maximized, setMaximized] = useState(false);
	useEffect(() => {
		if (!enabled) return;
		let live = true;
		let unlisten: (() => void) | undefined;
		import("@tauri-apps/api/window").then(async ({ getCurrentWindow }) => {
			const win = getCurrentWindow();
			const update = async () => {
				const next = await win.isMaximized();
				if (live) setMaximized(next);
			};
			await update();
			const stop = await win.onResized(update);
			if (live) unlisten = stop;
			else stop();
		});
		return () => {
			live = false;
			unlisten?.();
		};
	}, [enabled]);
	return maximized;
}
