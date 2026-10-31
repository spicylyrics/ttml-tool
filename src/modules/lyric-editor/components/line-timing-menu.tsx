import { ContextMenu } from "@radix-ui/themes";
import { atom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useTranslation } from "react-i18next";
import { currentTimeAtom } from "$/modules/audio/states";
import { cmdDuplicatePaste } from "$/modules/keyboard/commands";
import { spectrogramSelectionAtom } from "$/modules/spectrogram/states";
import { insertDuplicatedLines } from "$/modules/spectrogram/utils/duplicate-paste";
import { lyricLinesAtom, selectedLinesAtom } from "$/states/main";
import { formatKeyBindings } from "$/utils/keybindings";
import {
	createLineTimingSnapshots,
	snapSelectedLineTimingsToTime,
} from "../utils/line-timing";
import { repairSectionIntegrity } from "../utils/section-system";
import {
	globalEnableInsertAtom,
	timingCopyPlacementAtom,
} from "./lyric-line-view-states";

const selectedLinesSizeAtom = atom((get) => get(selectedLinesAtom).size);

export function LineTimingMenuItems() {
	const { t } = useTranslation();
	const store = useStore();
	const selectedLinesSize = useAtomValue(selectedLinesSizeAtom);
	const timingCopyPlacement = useAtomValue(timingCopyPlacementAtom);
	const setTimingCopyPlacement = useSetAtom(timingCopyPlacementAtom);
	const setGlobalEnableInsert = useSetAtom(globalEnableInsertAtom);
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const duplicatePasteKeys = useAtomValue(cmdDuplicatePaste.atom);
	const spectrogramSelection = useAtomValue(spectrogramSelectionAtom);

	const toggleTimingCopy = () => {
		if (timingCopyPlacement) {
			setTimingCopyPlacement(null);
			return;
		}

		const lyrics = store.get(lyricLinesAtom).lyricLines;
		const selectedLineIds = store.get(selectedLinesAtom);
		const snapshots = createLineTimingSnapshots(lyrics, selectedLineIds);
		if (snapshots.length === 0) return;

		setGlobalEnableInsert(false);
		setTimingCopyPlacement({
			sourceLineIds: snapshots.map(({ sourceLineId }) => sourceLineId),
			snapshots,
		});
	};

	const snapToPlayhead = () => {
		const selectedLineIds = store.get(selectedLinesAtom);
		const currentTime = store.get(currentTimeAtom);
		editLyricLines((state) => {
			snapSelectedLineTimingsToTime(
				state.lyricLines,
				selectedLineIds,
				currentTime,
			);
		});
		setGlobalEnableInsert(false);
		setTimingCopyPlacement(null);
	};

	const duplicateAtPlayhead = () => {
		const selectedLineIds = store.get(selectedLinesAtom);
		const selection = store.get(spectrogramSelectionAtom);
		const currentTime = store.get(currentTimeAtom);
		editLyricLines((state) => {
			insertDuplicatedLines(
				state.lyricLines,
				selectedLineIds,
				selection ?? { start: currentTime },
			);
			repairSectionIntegrity(state);
		});
		if (selection) store.set(spectrogramSelectionAtom, null);
		setGlobalEnableInsert(false);
		setTimingCopyPlacement(null);
	};

	// While a timing copy is waiting for its target, cancelling it is the only
	// thing worth a right-click, so it stands on its own.
	if (timingCopyPlacement)
		return (
			<ContextMenu.Item onSelect={toggleTimingCopy}>
				{t("contextMenu.cancelCopyTimings", "Cancel timing copy")}
			</ContextMenu.Item>
		);

	// One-off tools, so they share one row instead of three.
	return (
		<ContextMenu.Sub>
			<ContextMenu.SubTrigger disabled={selectedLinesSize === 0}>
				{t("contextMenu.timing", "Timing")}
			</ContextMenu.SubTrigger>
			<ContextMenu.SubContent>
				<ContextMenu.Item onSelect={toggleTimingCopy}>
					{t("contextMenu.copyTimingsTo", "Copy timings to…")}
				</ContextMenu.Item>
				<ContextMenu.Item onSelect={snapToPlayhead}>
					{t(
						"contextMenu.snapSelectedLinesToPlayhead",
						"Snap selected lines to playhead",
					)}
				</ContextMenu.Item>
				<ContextMenu.Item
					onSelect={duplicateAtPlayhead}
					shortcut={
						duplicatePasteKeys
							? formatKeyBindings(duplicatePasteKeys)
							: undefined
					}
				>
					{spectrogramSelection
						? t(
								"contextMenu.duplicateIntoSelection",
								"Duplicate into spectrogram selection",
							)
						: t("contextMenu.duplicateAtPlayhead", "Duplicate at playhead")}
				</ContextMenu.Item>
			</ContextMenu.SubContent>
		</ContextMenu.Sub>
	);
}
