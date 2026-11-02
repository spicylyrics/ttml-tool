import type { TTMLMetadata } from "$/types/ttml";

/** The fields the metadata editor always shows, in the order it shows them. */
export const BUILTIN_METADATA_KEYS = [
	"songwriter",
	"musicName",
	"artists",
	"album",
	"cover_art",
] as const;

export const isBuiltinMetadataKey = (key: string) =>
	(BUILTIN_METADATA_KEYS as readonly string[]).includes(key);

export const metadataValues = (metadata: TTMLMetadata[], key: string) =>
	metadata.find((entry) => entry.key === key)?.value ?? [];

/**
 * Replaces a field's values in place (for an immer draft). Blank values are
 * dropped, and with `removeWhenEmpty` a field left with none is removed, so a
 * cleared field isn't saved as an empty tag.
 */
export function setMetadataValues(
	metadata: TTMLMetadata[],
	key: string,
	values: string[],
	{ removeWhenEmpty = true } = {},
): void {
	const kept = values.filter((value) => value.trim());
	const index = metadata.findIndex((entry) => entry.key === key);
	if (kept.length === 0 && removeWhenEmpty) {
		if (index !== -1) metadata.splice(index, 1);
		return;
	}
	if (index === -1) metadata.push({ key, value: kept });
	else metadata[index].value = kept;
}
