/** Lyric formats the file opener parses. */
export const LYRIC_EXTENSIONS: ReadonlySet<string> = new Set([
	"ttml",
	"lrc",
	"eslrc",
	"qrc",
	"yrc",
	"lys",
]);

const extensionOf = (name: string) => {
	const dot = name.lastIndexOf(".");
	return dot === -1 ? "" : name.slice(dot + 1).toLowerCase();
};

/**
 * Picks what to open from one drop: the first lyric file and the first audio
 * file, by position. Anything else (a second TTML, an image) is left out.
 * Returns indexes into the dropped list.
 */
export function routeDroppedFiles(
	names: readonly string[],
	audioExtensions: ReadonlySet<string>,
): { lyric?: number; audio?: number; ignored: number[] } {
	let lyric: number | undefined;
	let audio: number | undefined;
	const ignored: number[] = [];
	names.forEach((name, index) => {
		const ext = extensionOf(name);
		if (lyric === undefined && LYRIC_EXTENSIONS.has(ext)) lyric = index;
		else if (audio === undefined && audioExtensions.has(ext)) audio = index;
		else ignored.push(index);
	});
	return { lyric, audio, ignored };
}
