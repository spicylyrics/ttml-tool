import { APP_VERSION, GIT_COMMIT } from "virtual:buildmeta";
import { invoke } from "@tauri-apps/api/core";
import { arch, platform, version } from "@tauri-apps/plugin-os";
import type { createStore } from "jotai";
import i18n from "$/i18n";
import {
	geniusApiKeyAtom,
	spicyLyricsDesignAtom,
} from "$/modules/settings/states";
import { recentErrors } from "$/utils/errorLog";
import {
	browserName,
	type InstallKind,
	type ReportInfo,
	redactSecrets,
} from "./report";

type Store = ReturnType<typeof createStore>;

const OS_NAMES: Record<string, string> = {
	windows: "Windows",
	macos: "macOS",
	linux: "Linux",
};

function browserOs(userAgent: string) {
	if (/Windows/.test(userAgent)) return "Windows";
	if (/Mac OS X|Macintosh/.test(userAgent)) return "macOS";
	if (/Android/.test(userAgent)) return "Android";
	if (/Linux|X11/.test(userAgent)) return "Linux";
	return "Other";
}

/** What the app knows about where it runs, read when a report opens. */
export async function collectReportInfo(store: Store): Promise<ReportInfo> {
	const shared = {
		version: APP_VERSION,
		commit: GIT_COMMIT,
		design: store.get(spicyLyricsDesignAtom),
		language: i18n.language,
		errors: recentErrors(),
	};
	if (!import.meta.env.TAURI_ENV_PLATFORM) {
		const userAgent = navigator.userAgent;
		return {
			...shared,
			install: "website",
			host: window.location.host,
			os: browserOs(userAgent),
			browser: browserName(userAgent),
		};
	}
	const name = platform();
	const install = await invoke<InstallKind>("install_kind").catch(
		() => "unknown" as const,
	);
	return {
		...shared,
		install,
		os: `${OS_NAMES[name] ?? name} ${version()} (${arch()})`,
		browser: null,
	};
}

/** The secrets the app holds, to blank out of anything it shares. */
export const knownSecrets = (store: Store) => [store.get(geniusApiKeyAtom)];

export const redactForReport = (text: string, store: Store) =>
	redactSecrets(text, knownSecrets(store));
