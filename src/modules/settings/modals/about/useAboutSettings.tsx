import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getContributors } from "$/modules/settings/utils/contributor-count";
import { clearWebsiteCache, forceWebsiteRefresh } from "$/utils/pwa";
import { useAppUpdate } from "$/utils/useAppUpdate";
export function useAboutSettings() {
	const { t } = useTranslation();
	const { status, update, progress, errorMsg, installUpdate, restartApp } =
		useAppUpdate();
	const [cacheConfirmationOpen, setCacheConfirmationOpen] = useState(false);
	const [recoveryAction, setRecoveryAction] = useState<
		"refresh" | "clear" | null
	>(null);
	const contributors = getContributors();
	// A failed install keeps its update, so it stays on screen with the reason.
	// A failed background check has none and stays quiet (say, when offline).
	const showUpdateCard =
		["available", "downloading", "ready"].includes(status) ||
		(status === "error" && update !== null);
	const isWebsite = !import.meta.env.TAURI_ENV_PLATFORM;
	const handleForceRefresh = async () => {
		setRecoveryAction("refresh");
		try {
			await forceWebsiteRefresh();
		} finally {
			setRecoveryAction(null);
		}
	};
	const handleClearCache = async () => {
		setRecoveryAction("clear");
		try {
			await clearWebsiteCache();
		} finally {
			setRecoveryAction(null);
			setCacheConfirmationOpen(false);
		}
	};
	return {
		t,
		status,
		update,
		progress,
		errorMsg,
		installUpdate,
		restartApp,
		cacheConfirmationOpen,
		setCacheConfirmationOpen,
		recoveryAction,
		setRecoveryAction,
		contributors,
		showUpdateCard,
		isWebsite,
		handleForceRefresh,
		handleClearCache,
	};
}
export type AboutSettings = ReturnType<typeof useAboutSettings>;
