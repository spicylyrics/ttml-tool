import { openDB } from "idb";
import { atom } from "jotai";
import { atomWithStorage } from "jotai/utils";

const CUSTOM_BACKGROUND_DB = "amll-custom-background";
const CUSTOM_BACKGROUND_STORE = "background-image";
const CUSTOM_BACKGROUND_KEY = "main";
type CustomBackgroundRecord = {
	key: string;
	blob: Blob;
	updatedAt: number;
};
const customBackgroundDbPromise = openDB(CUSTOM_BACKGROUND_DB, 1, {
	upgrade(db) {
		if (!db.objectStoreNames.contains(CUSTOM_BACKGROUND_STORE)) {
			db.createObjectStore(CUSTOM_BACKGROUND_STORE, { keyPath: "key" });
		}
	},
});
// Versions before 2026-02 kept the image here as a data URL. It is no longer
// read; drop it so it stops using up the storage quota.
try {
	localStorage.removeItem("customBackgroundImage");
} catch {}
export const customBackgroundImageKeyAtom = atomWithStorage<string | null>(
	"customBackgroundImageKey",
	"main",
	undefined,
	{ getOnInit: true },
);
const getStoredBackgroundKey = (): string | null => {
	try {
		const raw = localStorage.getItem("customBackgroundImageKey");
		if (raw === null) return CUSTOM_BACKGROUND_KEY;
		const value: unknown = JSON.parse(raw);
		return typeof value === "string" ? value : null;
	} catch {
		return CUSTOM_BACKGROUND_KEY;
	}
};
export const readCustomBackgroundBlob = async (
	key = getStoredBackgroundKey(),
) => {
	if (key === null) return null;
	try {
		const db = await customBackgroundDbPromise;
		const record = (await db.get(CUSTOM_BACKGROUND_STORE, key)) as
			| CustomBackgroundRecord
			| undefined;
		if (record?.blob) return record.blob;
	} catch {}
	return null;
};
export const writeCustomBackgroundBlob = async (
	blob: Blob | null,
): Promise<string | null> => {
	let key: string | null = null;
	if (blob) {
		const digest = await crypto.subtle.digest(
			"SHA-256",
			await blob.arrayBuffer(),
		);
		key = `image:${Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("")}`;
		const db = await customBackgroundDbPromise;
		if (!(await db.get(CUSTOM_BACKGROUND_STORE, key))) {
			const record: CustomBackgroundRecord = {
				key,
				blob,
				updatedAt: Date.now(),
			};
			await db.put(CUSTOM_BACKGROUND_STORE, record);
		}
	}
	// Clearing the active image must not delete images still used by presets.
	localStorage.setItem("customBackgroundImageKey", JSON.stringify(key));
	return key;
};
const customBackgroundImageValueAtom = atom<string | null>(null);
export const customBackgroundImageAtom = atom(
	(get) => get(customBackgroundImageValueAtom),
	async (get, set, next: File | Blob | string | null) => {
		const key =
			typeof next === "string" ? next : await writeCustomBackgroundBlob(next);
		const blob =
			typeof next === "string" ? await readCustomBackgroundBlob(next) : next;
		// A preset imported on another machine may reference an image unavailable locally.
		// Preserve the current image in that case instead of silently clearing it.
		if (typeof next === "string" && !blob) return false;
		const previous = get(customBackgroundImageValueAtom);
		const url = blob ? URL.createObjectURL(blob) : null;
		set(customBackgroundImageKeyAtom, key);
		set(customBackgroundImageValueAtom, url);
		if (previous) URL.revokeObjectURL(previous);
		return true;
	},
);
export const customBackgroundImageInitAtom = atom(null, async (get, set) => {
	const previous = get(customBackgroundImageValueAtom);
	const key = get(customBackgroundImageKeyAtom);
	const blob = await readCustomBackgroundBlob(key);
	set(customBackgroundImageKeyAtom, blob ? key : null);
	set(customBackgroundImageValueAtom, blob ? URL.createObjectURL(blob) : null);
	if (previous) URL.revokeObjectURL(previous);
});
export const customBackgroundOpacityAtom = atomWithStorage(
	"customBackgroundOpacity",
	0.8,
);
export const customBackgroundMaskAtom = atomWithStorage(
	"customBackgroundMask",
	0.2,
);
export const customBackgroundBlurAtom = atomWithStorage(
	"customBackgroundBlur",
	0,
);
export const customBackgroundBrightnessAtom = atomWithStorage(
	"customBackgroundBrightness",
	1,
);
