import { lazy, Suspense } from "react";
import { LatencyTestDialog } from "$/modules/audio/modals/LatencyTest.tsx";
import { GeniusSearchDialog } from "$/modules/genius/modals/GeniusSearchDialog.tsx";
import { UrbanDictionaryDialog } from "$/modules/lyric-editor/modals/UrbanDictionaryDialog.tsx";
import { CombineWordsDialog } from "$/modules/lyric-editor/tools/CombineWordsDialog.tsx";
import { ReplaceRomanizationDialog } from "$/modules/lyric-editor/tools/ReplaceRomanizationDialog.tsx";
import { ReplaceWordDialog } from "$/modules/lyric-editor/tools/ReplaceWordDialog.tsx";
import { TimeShiftDialog } from "$/modules/lyric-editor/tools/TimeShift.tsx";
import { TimeStretchDialog } from "$/modules/lyric-editor/tools/TimeStretch.tsx";
import { ImportLyricsDialog } from "$/modules/lyrics-import/modals/ImportLyricsDialog.tsx";
import { HistoryRestoreDialog } from "$/modules/project/modals/HistoryRestore.tsx";
import { MetadataEditor } from "$/modules/project/modals/MetadataEditor.tsx";
import { PasteRomanizationDialog } from "$/modules/romanization/PasteRomanizationDialog.tsx";
import { AdvancedSegmentationDialog } from "$/modules/segmentation/components/AdvancedSegmentation.tsx";

const ProjectsDialog = lazy(() =>
	import("$/modules/project/modals/ProjectsDialog").then((m) => ({
		default: m.ProjectsDialog,
	})),
);

import { AutoSegmentDialog } from "$/modules/segmentation/components/AutoSegmentDialog.tsx";
import { LearnedSplitsDialog } from "$/modules/segmentation/components/LearnedSplits.tsx";
import { SuggestedSplitsDialog } from "$/modules/segmentation/components/SuggestedSplits.tsx";
import { SplitWordDialog } from "$/modules/segmentation/components/split-word.tsx";
import { FontSelectionDialog } from "$/modules/settings/modals/FontSelectionDialog.tsx";
import { PreferencesDialog } from "$/modules/settings/shell/PreferencesDialog.tsx";
import { TTMLChecklistDialog } from "$/modules/ttml-checklist/TTMLChecklistDialog.tsx";
import { ChangelogDialog } from "./changelog.tsx";
import { ConfirmationDialog } from "./confirmation.tsx";
import { CreateProjectPromptDialog } from "./create-project-prompt.tsx";
import { GeniusHeaderDetectionDialog } from "./genius-header-detection.tsx";

export const Dialogs = () => {
	return (
		<>
			<ImportLyricsDialog />
			<MetadataEditor />
			<PreferencesDialog />
			<SplitWordDialog />
			<CombineWordsDialog />
			<ReplaceWordDialog />
			<ReplaceRomanizationDialog />
			<PasteRomanizationDialog />
			<LatencyTestDialog />
			<TTMLChecklistDialog />
			<ConfirmationDialog />
			<CreateProjectPromptDialog />
			<HistoryRestoreDialog />
			<Suspense fallback={null}>
				<ProjectsDialog />
			</Suspense>
			<AdvancedSegmentationDialog />
			<AutoSegmentDialog />
			<LearnedSplitsDialog />
			<TimeShiftDialog />
			<TimeStretchDialog />

			<GeniusSearchDialog />
			<ChangelogDialog />
			<FontSelectionDialog />
			<UrbanDictionaryDialog />
			<SuggestedSplitsDialog />
			<GeniusHeaderDetectionDialog />
		</>
	);
};

export default Dialogs;
