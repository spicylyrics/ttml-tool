import { invoke } from "@tauri-apps/api/core";
import { useAtomValue } from "jotai";
import { useEffect, useLayoutEffect } from "react";
import { log } from "$/utils/logging";
import { LOGO_COLOR_CSS_VAR, resolveLogoColor } from "./presets";
import { logoColorCustomAtom, logoColorPresetAtom } from "./states";

/** The color last sent to the desktop icon, so Default only resets once. */
const APPLIED_ICON_KEY = "logoColorAppliedIcon";
/** The custom color input fires on every drag step. */
const ICON_DEBOUNCE_MS = 400;

const readAppliedIcon = () => {
	try {
		return localStorage.getItem(APPLIED_ICON_KEY);
	} catch {
		return null;
	}
};

const writeAppliedIcon = (color: string | null) => {
	try {
		if (color) localStorage.setItem(APPLIED_ICON_KEY, color);
		else localStorage.removeItem(APPLIED_ICON_KEY);
	} catch {}
};

/**
 * Puts the chosen logo color on `<html>`, so portalled dialogs (the guide's
 * welcome screen) see it too, and on desktop recolors the window, taskbar
 * and shortcut icons. Default removes both.
 */
export const LogoColorStyle = () => {
	const preset = useAtomValue(logoColorPresetAtom);
	const custom = useAtomValue(logoColorCustomAtom);
	const color = resolveLogoColor(preset, custom);

	useLayoutEffect(() => {
		const style = document.documentElement.style;
		if (color) style.setProperty(LOGO_COLOR_CSS_VAR, color);
		else style.removeProperty(LOGO_COLOR_CSS_VAR);
		return () => {
			style.removeProperty(LOGO_COLOR_CSS_VAR);
		};
	}, [color]);

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) return;
		// Runs on every launch with a color, so shortcuts an update rewrote get
		// it back. With Default, only when a color was applied before.
		if (!color && !readAppliedIcon()) return;
		const timer = window.setTimeout(() => {
			invoke("apply_app_icon", { color })
				.then(() => writeAppliedIcon(color))
				.catch((error) => log("Unable to apply the app icon", error));
		}, ICON_DEBOUNCE_MS);
		return () => window.clearTimeout(timer);
	}, [color]);

	return null;
};
