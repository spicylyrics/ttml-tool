import { CommandPalette } from "$/modules/command-palette/CommandPaletteHost.tsx";
import { editAsTextDialogAtom } from "$/modules/edit-as-text/states.ts";
import { pasteRomanizationDialogAtom } from "$/modules/romanization/states.ts";
import { PreferencesDialog } from "$/modules/settings/shell/PreferencesDialog.tsx";
import {
	advancedSegmentationDialogAtom,
	autoSegmentDialogAtom,
	changelogDialogAtom,
	combineWordsDialogAtom,
	fontSelectionDialogAtom,
	geniusSearchDialogAtom,
	historyRestoreDialogAtom,
	importLyricsDialogAtom,
	latencyTestDialogAtom,
	learnedSplitsDialogAtom,
	metadataEditorDialogAtom,
	projectsDialogAtom,
	replaceRomanizationDialogAtom,
	replaceWordDialogAtom,
	settingsDialogAtom,
	splitWordDialogAtom,
	suggestedSplitsDialogAtom,
	timeShiftDialogAtom,
	timeStretchDialogAtom,
	ttmlChecklistDialogAtom,
} from "$/states/dialogs.ts";
import { urbanDictionaryDialogAtom } from "$/states/urban-dictionary.ts";
import { lazy } from "$/utils/lazy.ts";
import { ConfirmationDialog } from "./confirmation.tsx";
import { CreateProjectPromptDialog } from "./create-project-prompt.tsx";
import { GeniusHeaderDetectionDialog } from "./genius-header-detection.tsx";
import { LazyDialog } from "./LazyDialog.tsx";

// Dialogs that open on demand are fetched the first time they open. The small
// ones other flows chain into (confirmation, create-project prompt, Genius
// header detection) stay in this chunk so they appear without a fetch.

const ImportLyricsDialog = lazy(() =>
	import("$/modules/lyrics-import/modals/ImportLyricsDialog.tsx").then((m) => ({
		default: m.ImportLyricsDialog,
	})),
);
const MetadataEditor = lazy(() =>
	import("$/modules/project/modals/MetadataEditor.tsx").then((m) => ({
		default: m.MetadataEditor,
	})),
);
const SplitWordDialog = lazy(() =>
	import("$/modules/segmentation/components/split-word.tsx").then((m) => ({
		default: m.SplitWordDialog,
	})),
);
const CombineWordsDialog = lazy(() =>
	import("$/modules/lyric-editor/tools/CombineWordsDialog.tsx").then((m) => ({
		default: m.CombineWordsDialog,
	})),
);
const ReplaceWordDialog = lazy(() =>
	import("$/modules/lyric-editor/tools/ReplaceWordDialog.tsx").then((m) => ({
		default: m.ReplaceWordDialog,
	})),
);
const ReplaceRomanizationDialog = lazy(() =>
	import("$/modules/lyric-editor/tools/ReplaceRomanizationDialog.tsx").then(
		(m) => ({ default: m.ReplaceRomanizationDialog }),
	),
);
const PasteRomanizationDialog = lazy(() =>
	import("$/modules/romanization/PasteRomanizationDialog.tsx").then((m) => ({
		default: m.PasteRomanizationDialog,
	})),
);
const LatencyTestDialog = lazy(() =>
	import("$/modules/audio/modals/LatencyTest.tsx").then((m) => ({
		default: m.LatencyTestDialog,
	})),
);
const TTMLChecklistDialog = lazy(() =>
	import("$/modules/ttml-checklist/TTMLChecklistDialog.tsx").then((m) => ({
		default: m.TTMLChecklistDialog,
	})),
);
const HistoryRestoreDialog = lazy(() =>
	import("$/modules/project/modals/HistoryRestore.tsx").then((m) => ({
		default: m.HistoryRestoreDialog,
	})),
);
const ProjectsDialog = lazy(() =>
	import("$/modules/project/modals/ProjectsDialog.tsx").then((m) => ({
		default: m.ProjectsDialog,
	})),
);
const AdvancedSegmentationDialog = lazy(() =>
	import("$/modules/segmentation/components/AdvancedSegmentation.tsx").then(
		(m) => ({ default: m.AdvancedSegmentationDialog }),
	),
);
const AutoSegmentDialog = lazy(() =>
	import("$/modules/segmentation/components/AutoSegmentDialog.tsx").then(
		(m) => ({ default: m.AutoSegmentDialog }),
	),
);
const LearnedSplitsDialog = lazy(() =>
	import("$/modules/segmentation/components/LearnedSplits.tsx").then((m) => ({
		default: m.LearnedSplitsDialog,
	})),
);
const TimeShiftDialog = lazy(() =>
	import("$/modules/lyric-editor/tools/TimeShift.tsx").then((m) => ({
		default: m.TimeShiftDialog,
	})),
);
const TimeStretchDialog = lazy(() =>
	import("$/modules/lyric-editor/tools/TimeStretch.tsx").then((m) => ({
		default: m.TimeStretchDialog,
	})),
);
const GeniusSearchDialog = lazy(() =>
	import("$/modules/genius/modals/GeniusSearchDialog.tsx").then((m) => ({
		default: m.GeniusSearchDialog,
	})),
);
const ChangelogDialog = lazy(() =>
	import("./changelog.tsx").then((m) => ({ default: m.ChangelogDialog })),
);
const FontSelectionDialog = lazy(() =>
	import("$/modules/settings/modals/FontSelectionDialog.tsx").then((m) => ({
		default: m.FontSelectionDialog,
	})),
);
const UrbanDictionaryDialog = lazy(() =>
	import("$/modules/lyric-editor/modals/UrbanDictionaryDialog.tsx").then(
		(m) => ({ default: m.UrbanDictionaryDialog }),
	),
);
const SuggestedSplitsDialog = lazy(() =>
	import("$/modules/segmentation/components/SuggestedSplits.tsx").then((m) => ({
		default: m.SuggestedSplitsDialog,
	})),
);
const EditAsTextDialog = lazy(() =>
	import("$/modules/edit-as-text/modals/EditAsTextDialog.tsx").then((m) => ({
		default: m.EditAsTextDialog,
	})),
);

const isOpen = (state: { open: boolean }) => state.open;

export const Dialogs = () => {
	return (
		<>
			<LazyDialog openAtom={importLyricsDialogAtom}>
				<ImportLyricsDialog />
			</LazyDialog>
			<LazyDialog openAtom={metadataEditorDialogAtom}>
				<MetadataEditor />
			</LazyDialog>
			<LazyDialog openAtom={settingsDialogAtom}>
				<PreferencesDialog />
			</LazyDialog>
			<LazyDialog openAtom={splitWordDialogAtom}>
				<SplitWordDialog />
			</LazyDialog>
			<LazyDialog openAtom={combineWordsDialogAtom} isOpen={isOpen}>
				<CombineWordsDialog />
			</LazyDialog>
			<LazyDialog openAtom={replaceWordDialogAtom}>
				<ReplaceWordDialog />
			</LazyDialog>
			<LazyDialog openAtom={replaceRomanizationDialogAtom} isOpen={isOpen}>
				<ReplaceRomanizationDialog />
			</LazyDialog>
			<LazyDialog openAtom={pasteRomanizationDialogAtom}>
				<PasteRomanizationDialog />
			</LazyDialog>
			<LazyDialog openAtom={latencyTestDialogAtom}>
				<LatencyTestDialog />
			</LazyDialog>
			<LazyDialog openAtom={ttmlChecklistDialogAtom}>
				<TTMLChecklistDialog />
			</LazyDialog>
			<ConfirmationDialog />
			<CreateProjectPromptDialog />
			<LazyDialog openAtom={historyRestoreDialogAtom}>
				<HistoryRestoreDialog />
			</LazyDialog>
			<LazyDialog openAtom={projectsDialogAtom}>
				<ProjectsDialog />
			</LazyDialog>
			<LazyDialog openAtom={advancedSegmentationDialogAtom}>
				<AdvancedSegmentationDialog />
			</LazyDialog>
			<LazyDialog openAtom={autoSegmentDialogAtom}>
				<AutoSegmentDialog />
			</LazyDialog>
			<LazyDialog openAtom={learnedSplitsDialogAtom}>
				<LearnedSplitsDialog />
			</LazyDialog>
			<LazyDialog openAtom={timeShiftDialogAtom}>
				<TimeShiftDialog />
			</LazyDialog>
			<LazyDialog openAtom={timeStretchDialogAtom}>
				<TimeStretchDialog />
			</LazyDialog>

			<LazyDialog openAtom={geniusSearchDialogAtom}>
				<GeniusSearchDialog />
			</LazyDialog>
			<LazyDialog openAtom={changelogDialogAtom}>
				<ChangelogDialog />
			</LazyDialog>
			<LazyDialog openAtom={fontSelectionDialogAtom}>
				<FontSelectionDialog />
			</LazyDialog>
			<LazyDialog openAtom={urbanDictionaryDialogAtom} isOpen={isOpen}>
				<UrbanDictionaryDialog />
			</LazyDialog>
			<LazyDialog openAtom={suggestedSplitsDialogAtom} isOpen={isOpen}>
				<SuggestedSplitsDialog />
			</LazyDialog>
			<GeniusHeaderDetectionDialog />
			<CommandPalette />
			<LazyDialog openAtom={editAsTextDialogAtom}>
				<EditAsTextDialog />
			</LazyDialog>
		</>
	);
};

export default Dialogs;
