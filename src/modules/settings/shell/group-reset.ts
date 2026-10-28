import type { SetStateAction, WritableAtom } from "jotai";
import { RESET } from "jotai/utils";
import {
	equalizerEnabledAtom,
	equalizerGainsAtom,
	equalizerPresetAtom,
	storedPlaybackRateAtom,
	volumeAtom,
} from "$/modules/audio/states";
import { advancedRibbonControlsAtom } from "$/modules/onboarding/states";
import { selectedPaletteIdAtom } from "$/modules/spectrogram/states";
import {
	showLineRomanizationAtom,
	showLineTranslationAtom,
	showWordRomanizationInputAtom,
} from "../states";
import {
	instantHighlightFadeAtom,
	lyricWordFadeWidthAtom,
	showFpsCounterAtom,
	showRomanLinesAtom,
	showTranslationLinesAtom,
	spicyBackgroundModeAtom,
	spicyForceLineSyncedAtom,
	spicySimpleLyricsModeAtom,
	storedPreviewModeTypeAtom,
	vsyncAtom,
} from "../states/preview";
import { timingOverviewAutoScrollAtom } from "../states/sync";
import type { ShellPageId } from "./page-map";

// biome-ignore lint/suspicious/noExplicitAny: settings hold values of every type.
type AnyValue = any;

/** A stored setting that `RESET` puts back to its default. */
export type ResettableAtom = WritableAtom<
	AnyValue,
	[SetStateAction<AnyValue> | typeof RESET],
	void
>;

export interface ResettableSetting {
	/** Translation key and fallback of the row's title, listed in the confirm. */
	labelKey: string;
	label: string;
	/** Every stored value behind that row. */
	atoms: readonly ResettableAtom[];
}

/**
 * The settings each shell page owns, for its "Reset to defaults" button. Only
 * pages whose stored atoms are known for sure are listed. Feature flags stay
 * with the Experimental page, and keybindings, backups, projects, API keys and
 * the Preferences layout flag are never part of a group.
 */
export const GROUP_RESETS: Partial<
	Record<ShellPageId, readonly ResettableSetting[]>
> = {
	editing: [
		{
			labelKey: "settings.common.advancedRibbonControls",
			label: "Show advanced ribbon controls",
			atoms: [advancedRibbonControlsAtom],
		},
		{
			labelKey: "ribbonBar.editMode.showTranslation",
			label: "Show translation line",
			atoms: [showLineTranslationAtom],
		},
		{
			labelKey: "ribbonBar.editMode.showRomanization",
			label: "Show romanization line",
			atoms: [showLineRomanizationAtom],
		},
		{
			labelKey: "ribbonBar.editMode.showWordRomanizationInput",
			label: "Show per-word romanization",
			atoms: [showWordRomanizationInputAtom],
		},
	],
	preview: [
		{
			labelKey: "ribbonBar.previewMode.mode",
			label: "Mode",
			atoms: [storedPreviewModeTypeAtom],
		},
		{
			labelKey: "ribbonBar.previewMode.background",
			label: "Background",
			atoms: [spicyBackgroundModeAtom],
		},
		{
			labelKey: "ribbonBar.previewMode.showTranslation",
			label: "Show translation",
			atoms: [showTranslationLinesAtom],
		},
		{
			labelKey: "ribbonBar.previewMode.showRoman",
			label: "Show romanization",
			atoms: [showRomanLinesAtom],
		},
		{
			labelKey: "ribbonBar.previewMode.simpleLyrics",
			label: "Simple Lyrics mode",
			atoms: [spicySimpleLyricsModeAtom],
		},
		{
			labelKey: "ribbonBar.previewMode.forceLineRendering",
			label: "Show as line-synced",
			atoms: [spicyForceLineSyncedAtom],
		},
		{
			labelKey: "ribbonBar.previewMode.instantFade",
			label: "Instant fade-out",
			atoms: [instantHighlightFadeAtom],
		},
		{
			labelKey: "ribbonBar.previewMode.autoScroll",
			label: "Auto-Scroll",
			atoms: [timingOverviewAutoScrollAtom],
		},
		{
			labelKey: "ribbonBar.previewMode.fadeWidth",
			label: "Fade width",
			atoms: [lyricWordFadeWidthAtom],
		},
		{
			labelKey: "settings.preview.vsync",
			label: "Smooth preview (every frame)",
			atoms: [vsyncAtom],
		},
		{
			labelKey: "ribbonBar.previewMode.showFps",
			label: "Show FPS",
			atoms: [showFpsCounterAtom],
		},
	],
	audio: [
		{
			labelKey: "settings.common.volume",
			label: "Music volume",
			atoms: [volumeAtom],
		},
		{
			labelKey: "settings.common.playbackRate",
			label: "Playback speed",
			atoms: [storedPlaybackRateAtom],
		},
		{
			labelKey: "settings.audio.equalizer",
			label: "Audio equalizer",
			atoms: [equalizerEnabledAtom, equalizerGainsAtom, equalizerPresetAtom],
		},
		{
			labelKey: "settings.spectrogram.palette",
			label: "Color palette",
			atoms: [selectedPaletteIdAtom],
		},
	],
};

/** Writes `RESET` to every stored value behind the given settings. */
export function resetSettings(
	set: (setting: ResettableAtom, value: typeof RESET) => void,
	settings: readonly ResettableSetting[],
) {
	for (const setting of settings) {
		for (const stored of setting.atoms) set(stored, RESET);
	}
}
