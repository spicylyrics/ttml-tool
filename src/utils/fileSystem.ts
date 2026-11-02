import saveFileFromLib from "save-file";
import { error } from "./logging";

export interface SaveFileOptions {
	suggestedName?: string;
	types?: {
		description: string;
		accept: Record<string, string[]>;
	}[];
}

/**
 * Asks where to save and writes the file. Returns the saved file's name, or
 * null when the user cancels.
 */
export async function saveFile(
	content: Blob | string,
	options: SaveFileOptions | string,
) {
	const suggestedName =
		typeof options === "string" ? options : options.suggestedName;
	const types = typeof options === "string" ? undefined : options.types;

	// The desktop app saves through its own dialog. Its webviews can't be
	// trusted with either browser path below: macOS and Linux have no
	// showSaveFilePicker, and they drop download links without a word, so
	// saving did nothing at all there.
	if (import.meta.env.TAURI_ENV_PLATFORM)
		return saveWithNativeDialog(content, suggestedName, types);

	if ("showSaveFilePicker" in window) {
		try {
			// @ts-expect-error
			const handle = await window.showSaveFilePicker({
				suggestedName,
				types,
			});
			const writable = await handle.createWritable();
			await writable.write(content);
			await writable.close();
			return handle.name as string;
		} catch (e: any) {
			if (e.name === "AbortError") return null;
			error("Failed to save file via File System Access API", e);
		}
	}

	const b =
		typeof content === "string"
			? new Blob([content], { type: "text/plain" })
			: content;
	await saveFileFromLib(b, suggestedName || "file");
	return suggestedName;
}

async function saveWithNativeDialog(
	content: Blob | string,
	suggestedName: string | undefined,
	types: SaveFileOptions["types"],
): Promise<string | null> {
	const [{ save }, { writeFile, writeTextFile }] = await Promise.all([
		import("@tauri-apps/plugin-dialog"),
		import("@tauri-apps/plugin-fs"),
	]);
	const path = await save({
		defaultPath: suggestedName,
		filters: types?.map((type) => ({
			name: type.description,
			extensions: Object.values(type.accept)
				.flat()
				.map((extension) => extension.replace(/^\./, "")),
		})),
	});
	if (!path) return null;
	// A path picked in the dialog is allowed for writing for this session.
	if (typeof content === "string") await writeTextFile(path, content);
	else await writeFile(path, new Uint8Array(await content.arrayBuffer()));
	return path.split(/[\\/]/).pop() || suggestedName || path;
}
