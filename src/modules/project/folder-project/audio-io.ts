import { isTauri } from "@tauri-apps/api/core";
import { exists, readFile, stat, writeFile } from "@tauri-apps/plugin-fs";
import {
	assertSafePath,
	getFileExtension,
	isSafeLinkedPath,
} from "$/modules/project/folder-project/manifest";

export const AUDIO_MIME_BY_EXT: Record<string, string> = {
	flac: "audio/flac",
	wav: "audio/wav",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	aac: "audio/aac",
	ogg: "audio/ogg",
	opus: "audio/opus",
};

export { AUDIO_EXTENSIONS as AUDIO_EXTS } from "$/utils/audio-formats";
export const MAX_AUDIO_BYTES = 150 * 1024 * 1024;

export async function checkAudioFileSize(safePath: string): Promise<number> {
	if (!isTauri()) {
		throw new Error("Filesystem operations are only available on desktop");
	}
	const fileStat = await stat(safePath);
	if (!fileStat.isFile) {
		throw new Error(`Audio path is not a regular file: ${safePath}`);
	}
	if (fileStat.size > MAX_AUDIO_BYTES) {
		throw new Error(
			`Audio file size (${Math.round(fileStat.size / (1024 * 1024))}MB) exceeds 150MB safety limit`,
		);
	}
	return fileStat.size;
}

export async function loadProjectAudioFile(
	baseDir: string,
	relativeFileName: string,
): Promise<File | null> {
	if (!isTauri()) {
		throw new Error("Filesystem operations are only available on desktop");
	}
	const safePath = assertSafePath(baseDir, relativeFileName);
	const fileExists = await exists(safePath);
	if (!fileExists) {
		return null;
	}

	await checkAudioFileSize(safePath);

	const audioBytes = await readFile(safePath);
	if (audioBytes.byteLength > MAX_AUDIO_BYTES) {
		throw new Error(
			`Audio buffer size (${Math.round(audioBytes.byteLength / (1024 * 1024))}MB) exceeds 150MB safety limit`,
		);
	}

	const ext = getFileExtension(relativeFileName);
	return new File([audioBytes as BlobPart], relativeFileName, {
		type: AUDIO_MIME_BY_EXT[ext] ?? "",
	});
}

export async function writeProjectAudioFile(
	baseDir: string,
	relativeFileName: string,
	audioBytes: Uint8Array,
): Promise<string> {
	if (!isTauri()) {
		throw new Error("Filesystem operations are only available on desktop");
	}
	if (audioBytes.byteLength > MAX_AUDIO_BYTES) {
		throw new Error(
			`Cannot write audio file: size (${Math.round(audioBytes.byteLength / (1024 * 1024))}MB) exceeds 150MB safety limit`,
		);
	}
	const safePath = assertSafePath(baseDir, relativeFileName);
	await writeFile(safePath, audioBytes);
	return safePath;
}

/**
 * Reopens audio from an absolute path picked earlier. Returns null when the
 * file moved or the app has no access to it any more.
 */
export async function readAudioFileAt(path: string): Promise<File | null> {
	if (!isTauri() || !isSafeLinkedPath(path)) return null;
	try {
		if (!(await exists(path))) return null;
		await checkAudioFileSize(path);
		const bytes = await readFile(path);
		const name = path.split(/[\\/]/).pop() ?? "audio";
		const ext = getFileExtension(name);
		const file = new File([bytes as BlobPart], name, {
			type: AUDIO_MIME_BY_EXT[ext] ?? "application/octet-stream",
		});
		Object.defineProperty(file, "path", { value: path });
		return file;
	} catch {
		return null;
	}
}
