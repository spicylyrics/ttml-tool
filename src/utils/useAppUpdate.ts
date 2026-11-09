import { invoke } from "@tauri-apps/api/core";
import { relaunch } from "@tauri-apps/plugin-process";
import { Update } from "@tauri-apps/plugin-updater";
import { useAtom, useStore } from "jotai";
import { useCallback } from "react";
import {
	betaUpdatesAtom,
	canSelfUpdateAtom,
	installKindAtom,
	updateErrorAtom,
	updateInfoAtom,
	updateProgressAtom,
	updateStatusAtom,
} from "$/states/update";

type UpdateMetadata = ConstructorParameters<typeof Update>[0];

export function useAppUpdate() {
	const [status, setStatus] = useAtom(updateStatusAtom);
	const [update, setUpdate] = useAtom(updateInfoAtom);
	const [progress, setProgress] = useAtom(updateProgressAtom);
	const [errorMsg, setErrorMsg] = useAtom(updateErrorAtom);
	const store = useStore();

	const checkUpdate = useCallback(
		async (silent = false) => {
			const currentStatus = store.get(updateStatusAtom);
			if (currentStatus === "checking" || currentStatus === "downloading")
				return;

			setStatus("checking");
			setErrorMsg("");

			try {
				store.set(canSelfUpdateAtom, await invoke<boolean>("can_self_update"));
				store.set(installKindAtom, await invoke<string>("install_kind"));
				// The plugin's check can't pick a feed, so ours picks stable or beta.
				const metadata = await invoke<UpdateMetadata | null>("check_update", {
					beta: store.get(betaUpdatesAtom),
				});
				const updateResult = metadata ? new Update(metadata) : null;
				if (updateResult) {
					setUpdate(updateResult);
					setStatus("available");
				} else {
					setUpdate(null);
					setStatus("up-to-date");
				}
			} catch (e) {
				if (!silent) {
					console.error("Failed to check for updates", e);
				}
				setStatus("error");
				setErrorMsg(String(e));
			}
		},
		[setStatus, setUpdate, setErrorMsg, store],
	);

	const installUpdate = useCallback(async () => {
		if (!update || !store.get(canSelfUpdateAtom)) return;

		setStatus("downloading");
		setProgress(0);

		let downloadedBytes = 0;
		let totalBytes = 0;

		try {
			await update.downloadAndInstall((event) => {
				switch (event.event) {
					case "Started":
						totalBytes = event.data.contentLength || 0;
						downloadedBytes = 0;
						setProgress(0);
						break;
					case "Progress":
						downloadedBytes += event.data.chunkLength;
						if (totalBytes > 0) {
							setProgress((downloadedBytes / totalBytes) * 100);
						}
						break;
					case "Finished":
						setProgress(100);
						break;
				}
			});

			setStatus("ready");
			await restartApp();
		} catch (e) {
			console.error("Failed to install update", e);
			setStatus("install-failed");
			// The raw reason, so a report can say why (release builds keep no log).
			setErrorMsg(String(e));
		}
	}, [update, setStatus, setProgress, setErrorMsg, store]);

	return {
		status,
		update,
		progress,
		errorMsg,
		checkUpdate,
		installUpdate,
		restartApp,
	};
}

// Starts the installed binary again. Reloading the page would keep the old
// version running until the user quits the app themselves.
async function restartApp() {
	try {
		await relaunch();
	} catch (e) {
		console.error("Relaunch failed", e);
	}
}
