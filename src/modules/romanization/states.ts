import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { JapaneseGranularity } from "$/modules/segmentation/utils/japanese-split";

export const japaneseGranularitySettingAtom =
	atomWithStorage<JapaneseGranularity>(
		"romanization.japaneseGranularity",
		"syllable",
	);

export const romanizationPanelAtom = atom(false);
