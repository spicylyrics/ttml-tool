import { useAtomValue } from "jotai";
import { useLayoutEffect } from "react";
import { LOGO_COLOR_CSS_VAR, resolveLogoColor } from "./presets";
import {
	logoColorCustomAtom,
	logoColorEnabledAtom,
	logoColorPresetAtom,
} from "./states";

/**
 * Puts the chosen logo color on `<html>`, so portalled dialogs (the guide's
 * welcome screen) see it too. Removes it when off, which leaves every logo on
 * its own fallback color.
 */
export const LogoColorStyle = () => {
	const enabled = useAtomValue(logoColorEnabledAtom);
	const preset = useAtomValue(logoColorPresetAtom);
	const custom = useAtomValue(logoColorCustomAtom);
	const color = resolveLogoColor(enabled, preset, custom);

	useLayoutEffect(() => {
		const style = document.documentElement.style;
		if (color) style.setProperty(LOGO_COLOR_CSS_VAR, color);
		else style.removeProperty(LOGO_COLOR_CSS_VAR);
		return () => {
			style.removeProperty(LOGO_COLOR_CSS_VAR);
		};
	}, [color]);

	return null;
};
