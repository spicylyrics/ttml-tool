export type TranscriptionKeyAction =
	| "playPause"
	| "seekBackward"
	| "seekForward"
	| "slower"
	| "faster"
	| "resetSpeed";

/** How far the seek keys jump, in seconds. */
export const TRANSCRIPTION_SEEK_SECONDS = 3;

type KeyLike = Pick<
	KeyboardEvent,
	"code" | "altKey" | "ctrlKey" | "metaKey" | "shiftKey" | "isComposing"
>;

// Matched by physical key so layouts and macOS Option characters don't matter.
const ALT_KEYS: Record<string, TranscriptionKeyAction> = {
	KeyK: "playPause",
	KeyJ: "seekBackward",
	KeyL: "seekForward",
	Comma: "slower",
	Period: "faster",
	Slash: "resetSpeed",
};

/**
 * The transport keys that work while typing in the transcript. Esc or Alt+K
 * plays and pauses, Alt+J / Alt+L seek, Alt+, / Alt+. change the speed and
 * Alt+/ resets it. Ctrl and Meta must be up: AltGr reports Ctrl+Alt on
 * Windows and types letters on many layouts.
 */
export function transcriptionKeyAction(
	event: KeyLike,
): TranscriptionKeyAction | null {
	if (event.isComposing || event.ctrlKey || event.metaKey || event.shiftKey)
		return null;
	if (!event.altKey) return event.code === "Escape" ? "playPause" : null;
	return ALT_KEYS[event.code] ?? null;
}
