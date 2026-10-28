import { atomWithStorage } from "jotai/utils";

/** Feature flag: shows the Transcribe tab next to Edit, Time and Preview. Off by default. */
export const transcriptionModeEnabledAtom = atomWithStorage(
	"transcriptionMode.enabled",
	false,
	undefined,
	{ getOnInit: true },
);

/**
 * The transcript draft. One per app, kept in local storage so it survives mode
 * switches, reloads and opening another project; it is not part of the TTML.
 */
export const transcriptTextAtom = atomWithStorage(
	"transcriptionMode.text",
	"",
	undefined,
	{ getOnInit: true },
);
