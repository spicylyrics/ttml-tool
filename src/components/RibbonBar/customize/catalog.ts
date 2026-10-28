import type { ParseKeys } from "i18next";

export type RibbonMode = "edit" | "sync" | "preview";

/** A section id: the i18n key of the section's label. */
export type SectionId = ParseKeys<"translation">;

export const RIBBON_MODES: readonly RibbonMode[] = ["edit", "sync", "preview"];

/**
 * The sections each ribbon can show, in their default order. A section's id is
 * the i18n key of its label, so a ribbon section is recognised from the label
 * it already passes and no section file has to know about customizing.
 *
 * The Advanced switch is left out on purpose: it stays last on every ribbon.
 * A section that isn't listed here keeps its place and can't be customized.
 */
export const RIBBON_SECTION_CATALOG: Record<RibbonMode, readonly SectionId[]> =
	{
		edit: [
			"ribbonBar.editMode.new",
			"ribbonBar.editMode.playbackTracking",
			"ribbonBar.editMode.lineTiming",
			"ribbonBar.editMode.lineProperties",
			"ribbonBar.editMode.romanization.section",
			"ribbonBar.editMode.wordTiming",
			"ribbonBar.editMode.wordProperties",
			"ribbonBar.editMode.secondaryContent",
			"ribbonBar.editMode.auxiliaryLineDisplay",
		],
		sync: [
			"ribbonBar.syncMode.syncAdjustment",
			"ribbonBar.syncMode.syncLevel",
			"ribbonBar.syncMode.playbackTracking",
			"ribbonBar.editMode.previewPanel",
			"ribbonBar.syncMode.bgLyricSync",
			"ribbonBar.syncMode.assistSettings",
			"ribbonBar.syncMode.displayOptions",
		],
		preview: [
			"ribbonBar.previewMode.mode",
			"ribbonBar.previewMode.spicy",
			"ribbonBar.previewMode.timing",
			"ribbonBar.previewMode.lyrics",
		],
	};
