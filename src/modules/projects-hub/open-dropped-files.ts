import { toast } from "react-toastify";
import { AUDIO_EXTENSIONS } from "$/utils/audio-formats";
import { attachDroppedFilePath } from "$/utils/droppedFilePath";
import { routeDroppedFiles } from "./logic/dropped-files";

type TFunc = (
	key: string,
	fallback?: string,
	options?: Record<string, unknown>,
) => string;

/**
 * Opens a multi-file drop: the first lyric file, then the first audio file,
 * each through the normal file opener. Without either, the first file goes to
 * the opener as before, so its "unsupported format" message still shows.
 */
export async function openDroppedFiles(
	files: readonly File[],
	openFile: (file: File) => void,
	t: TFunc,
): Promise<void> {
	if (files.length === 0) return;
	const route = routeDroppedFiles(
		files.map((file) => file.name),
		AUDIO_EXTENSIONS,
	);
	const picked = [route.lyric, route.audio]
		.filter((index): index is number => index !== undefined)
		.map((index) => files[index]);
	if (picked.length === 0) picked.push(files[0]);
	for (const file of picked) {
		await attachDroppedFilePath(file);
		openFile(file);
	}
	const skipped = files.length - picked.length;
	if (skipped > 0)
		toast.info(
			t(
				"projectsHub.drop.skipped",
				"{count, plural, one {Skipped # file. Drop one lyric file and one audio file at a time.} other {Skipped # files. Drop one lyric file and one audio file at a time.}}",
				{ count: skipped },
			),
		);
}
