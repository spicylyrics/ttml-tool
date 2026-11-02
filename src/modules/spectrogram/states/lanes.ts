import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { processedLyricLinesAtom } from "$/modules/segmentation/utils/segment-processing.ts";
import {
	createLaneLayoutCache,
	type LaneLayout,
	type SpectrogramLaneKind,
} from "$/modules/spectrogram/utils/lanes.ts";

/** Draw main and background lines in separate spectrogram lanes. */
export const spectrogramLanesEnabledAtom = atomWithStorage<boolean>(
	"settings_spectrogramLanes",
	false,
);

/** Give duet lines their own lane while lanes are on. */
export const spectrogramDuetLaneAtom = atomWithStorage<boolean>(
	"settings_spectrogramDuetLane",
	false,
);

/** Lanes hidden from the spectrogram for this session. */
export const spectrogramHiddenLanesAtom = atom<
	ReadonlySet<SpectrogramLaneKind>
>(new Set<SpectrogramLaneKind>());

const laneLayoutCache = createLaneLayoutCache();

/** Null while lanes are off; otherwise keeps its identity until a line's role changes. */
export const spectrogramLaneLayoutAtom = atom<LaneLayout | null>((get) => {
	if (!get(spectrogramLanesEnabledAtom)) return null;
	return laneLayoutCache(get(processedLyricLinesAtom), {
		duetLanes: get(spectrogramDuetLaneAtom),
	});
});
