import { open } from "@tauri-apps/plugin-shell";
export const CONTRIBUTORS_URL =
	"https://github.com/spicylyrics/ttml-tool/graphs/contributors";
export const RELEASES_URL =
	"https://github.com/spicylyrics/ttml-tool/releases/latest";
export const openExternal = async (url: string) => {
	if (import.meta.env.TAURI_ENV_PLATFORM) {
		await open(url);
	} else {
		window.open(url, "_blank");
	}
};
