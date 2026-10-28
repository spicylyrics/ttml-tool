import type { SegmentationEngineId } from "../types";

// Kept apart from `syllabification-engines.ts` so callers that only need the
// language don't pull the syllabification dictionaries into their chunk.
export const getHyphenationLanguage = (engine: SegmentationEngineId) =>
	engine.startsWith("hyphenation-")
		? engine.slice("hyphenation-".length)
		: undefined;
