import { getCurrentWebview } from "@tauri-apps/api/webview";
import { readFile } from "@tauri-apps/plugin-fs";

interface NativeFileDropHandlers {
	onDragging: (dragging: boolean) => void;
	onFiles: (files: File[]) => void;
}

/** Turns dropped paths into `File`s with their path attached. Folders and
 * unreadable paths are skipped. */
export async function readDroppedPaths(paths: string[]): Promise<File[]> {
	const results = await Promise.allSettled(
		paths.map(async (path) => {
			const bytes = await readFile(path);
			const name = path.split(/[\\/]/).pop() ?? path;
			const file = new File([bytes], name) as File & { path?: string };
			file.path = path;
			return file;
		}),
	);
	return results.flatMap((result) =>
		result.status === "fulfilled" ? [result.value] : [],
	);
}

/**
 * File drops handled by Tauri, which only reports them where native drag and
 * drop is on (Linux). WebKitGTK gives the page the drag but none of its
 * files, so the page's own drop handler can't open them there.
 */
export function listenNativeFileDrop({
	onDragging,
	onFiles,
}: NativeFileDropHandlers): () => void {
	let stop: (() => void) | undefined;
	let cancelled = false;
	getCurrentWebview()
		.onDragDropEvent(({ payload }) => {
			if (payload.type === "enter") onDragging(payload.paths.length > 0);
			else if (payload.type === "leave") onDragging(false);
			else if (payload.type === "drop") {
				onDragging(false);
				void readDroppedPaths(payload.paths).then((files) => {
					if (files.length > 0) onFiles(files);
				});
			}
		})
		.then(
			(unlisten) => {
				if (cancelled) unlisten();
				else stop = unlisten;
			},
			() => {},
		);
	return () => {
		cancelled = true;
		stop?.();
	};
}
