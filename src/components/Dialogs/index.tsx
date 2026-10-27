import { lazy, Suspense } from "react";
import { LatencyTestDialog } from "$/modules/audio/modals/LatencyTest.tsx";
import { GeniusImportLyricsDialog } from "$/modules/genius/modals/GeniusImportLyricsDialog.tsx";
import { GeniusSearchDialog } from "$/modules/genius/modals/GeniusSearchDialog.tsx";
import { ImportFromLRCLIB } from "$/modules/lrclib/modals/ImportDialog.tsx";
import { UrbanDictionaryDialog } from "$/modules/lyric-editor/modals/UrbanDictionaryDialog.tsx";
import { CombineWordsDialog } from "$/modules/lyric-editor/tools/CombineWordsDialog.tsx";
import { ReplaceRomanizationDialog } from "$/modules/lyric-editor/tools/ReplaceRomanizationDialog.tsx";
import { ReplaceWordDialog } from "$/modules/lyric-editor/tools/ReplaceWordDialog.tsx";
import { TimeShiftDialog } from "$/modules/lyric-editor/tools/TimeShift.tsx";
import { TimeStretchDialog } from "$/modules/lyric-editor/tools/TimeStretch.tsx";
import { HistoryRestoreDialog } from "$/modules/project/modals/HistoryRestore.tsx";
import { ImportFromText } from "$/modules/project/modals/ImportFromText.tsx";
import { MetadataEditor } from "$/modules/project/modals/MetadataEditor.tsx";
import { AdvancedSegmentationDialog } from "$/modules/segmentation/components/AdvancedSegmentation.tsx";

const ProjectsDialog = lazy(() =>
	import("$/modules/project/modals/ProjectsDialog").then((m) => ({
		default: m.ProjectsDialog,
	})),
);

import { ProblemsDialog } from "$/modules/linter/ProblemsDialog.tsx";
import { AutoSegmentDialog } from "$/modules/segmentation/components/AutoSegmentDialog.tsx";
import { LearnedSplitsDialog } from "$/modules/segmentation/components/LearnedSplits.tsx";
import { SuggestedSplitsDialog } from "$/modules/segmentation/components/SuggestedSplits.tsx";
import { SplitWordDialog } from "$/modules/segmentation/components/split-word.tsx";
import { FontSelectionDialog } from "$/modules/settings/modals/FontSelectionDialog.tsx";
import { SettingsDialog } from "$/modules/settings/modals/index.tsx";
import { TTMLChecklistDialog } from "$/modules/ttml-checklist/TTMLChecklistDialog.tsx";
import { ChangelogDialog } from "./changelog.tsx";
import { ConfirmationDialog } from "./confirmation.tsx";
import { CreateProjectPromptDialog } from "./create-project-prompt.tsx";
import { GeniusHeaderDetectionDialog } from "./genius-header-detection.tsx";
import { ImportLyricsChooserDialog } from "./import-lyrics-chooser.tsx";

export const Dialogs = () => {
	return (
		<>
			<ImportLyricsChooserDialog />
			<ImportFromText />
			<ImportFromLRCLIB />
			<MetadataEditor />
			<SettingsDialog />
			<SplitWordDialog />
			<CombineWordsDialog />
			<ReplaceWordDialog />
			<ReplaceRomanizationDialog />
			<LatencyTestDialog />
			<TTMLChecklistDialog />
			<ProblemsDialog />
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
			<GeniusImportLyricsDialog />
			<ChangelogDialog />
			<FontSelectionDialog />
			<UrbanDictionaryDialog />
			<SuggestedSplitsDialog />
			<GeniusHeaderDetectionDialog />
		</>
	);
};

export default Dialogs;
