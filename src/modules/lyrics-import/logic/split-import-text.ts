import type { SegmentationConfig } from "$/modules/segmentation/types";
import { segmentWord } from "$/modules/segmentation/utils/segmentation";
import { newLyricWord } from "$/types/ttml";
import { type ImportTextFormat, segmentImportText } from "./import-text";

/** Split one word with Auto Segment; Learned Splits win over the engine. */
export const splitWordForImport = (word: string, config: SegmentationConfig) =>
	segmentWord({ ...newLyricWord(), word }, config).map((part) => part.word);

/**
 * Mark syllables in the import text with the format's word separator, using
 * the segmentation settings and Learned Splits. Words that already carry a
 * marker are left alone, so running it again changes nothing.
 */
export function splitImportText(
	text: string,
	format: ImportTextFormat,
	config: SegmentationConfig,
): string {
	return segmentImportText(text, format, (word) =>
		splitWordForImport(word, config),
	);
}
