/**
 * How much of the app's visual effects to draw. "lite" drops blur, glow, entry
 * animations and moving backgrounds, which WebKitGTK renders far slower than
 * Chromium or WebView2. "auto" picks it for the Linux desktop app.
 */
export type EffectsMode = "auto" | "full" | "lite";

export const EFFECTS_MODES: readonly EffectsMode[] = ["auto", "full", "lite"];

/** `platform` is `import.meta.env.TAURI_ENV_PLATFORM`, undefined on the web. */
export function usesLiteEffects(
	mode: EffectsMode,
	platform: string | undefined,
): boolean {
	if (mode === "lite") return true;
	if (mode === "full") return false;
	return platform === "linux";
}
