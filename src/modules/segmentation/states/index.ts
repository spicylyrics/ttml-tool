/**
 * @description 管理分词设置的持久化状态
 */

import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";
import type { SegmentationEngineId } from "../types";

type Scope = "all" | "range";
type PunctuationMode = "merge" | "standalone";
type CustomRulesMap = Map<string, string[]>;
type CustomRulesStorage = [string, string[]][];
type LearnedRulesStorage = [string, number[]][];

export const segmentationScopeAtom = atomWithStorage<Scope>(
	"segmentation.scope",
	"all",
);
export const segmentationRangeStartAtom = atomWithStorage(
	"segmentation.rangeStart",
	"1",
);
export const segmentationRangeEndAtom = atomWithStorage(
	"segmentation.rangeEnd",
	"1",
);
export const segmentationSplitCJKAtom = atomWithStorage(
	"segmentation.splitCJK",
	true,
);
export const segmentationSplitEnglishAtom = atomWithStorage(
	"segmentation.splitEnglish",
	true,
);
const storedSegmentationEngineAtom = atomWithStorage<SegmentationEngineId>(
	"segmentation.engine",
	"prosodic",
);
/**
 * The engine for Latin words. A saved "japanese" (from when Japanese was an
 * engine; it now splits on its own) reads as the default.
 */
export const segmentationEngineAtom = atom(
	(get) => {
		const engine = get(storedSegmentationEngineAtom) as string;
		return engine === "japanese"
			? "prosodic"
			: (engine as SegmentationEngineId);
	},
	(_get, set, engine: SegmentationEngineId) =>
		set(storedSegmentationEngineAtom, engine),
);
export const segmentationPunctuationModeAtom = atomWithStorage<PunctuationMode>(
	"segmentation.punctuationMode",
	"merge",
);
export const segmentationPunctuationWeightAtom = atomWithStorage(
	"segmentation.punctuationWeight",
	"0.2",
);
export const segmentationRemoveEmptySegmentsAtom = atomWithStorage(
	"segmentation.removeEmptySegments",
	true,
);
export const segmentationIgnoreListTextAtom = atomWithStorage(
	"segmentation.ignoreListText",
	"",
);

const segmentationCustomRulesStorageAtom = atomWithStorage<CustomRulesStorage>(
	"segmentation.customRules",
	[],
);

export const segmentationCustomRulesAtom = atom<
	CustomRulesMap,
	[CustomRulesMap],
	void
>(
	(get) => {
		const rulesArray = get(segmentationCustomRulesStorageAtom);
		return new Map(rulesArray);
	},
	(_get, set, newMap) => {
		const rulesArray = Array.from(newMap.entries());
		set(segmentationCustomRulesStorageAtom, rulesArray);
	},
);

const segmentationLearnedRulesStorageAtom =
	atomWithStorage<LearnedRulesStorage>("segmentation.learnedRules", []);

export const segmentationLearnedRulesAtom = atom<
	Map<string, number[]>,
	[Map<string, number[]>],
	void
>(
	(get) => new Map(get(segmentationLearnedRulesStorageAtom)),
	(_get, set, rules) =>
		set(segmentationLearnedRulesStorageAtom, Array.from(rules.entries())),
);

export const splitWordApplyToAllAtom = atomWithStorage(
	"segmentation.splitWord.applyToAll",
	false,
);
export const splitWordIgnoreCaseAtom = atomWithStorage(
	"segmentation.splitWord.ignoreCase",
	true,
);
export const splitWordRememberAtom = atomWithStorage(
	"segmentation.splitWord.remember",
	true,
);
