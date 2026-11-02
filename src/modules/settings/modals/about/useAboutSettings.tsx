import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getContributors } from "$/modules/settings/utils/contributor-count";
import { clearWebsiteCache, forceWebsiteRefresh } from "$/utils/pwa";
import { useAppUpdate } from "$/utils/useAppUpdate";
export function useAboutSettings() {
	const { t } = useTranslation();
	const { status, update, progress, installUpdate, restartApp } =
		useAppUpdate();
	const [cacheConfirmationOpen, setCacheConfirmationOpen] = useState(false);
	const [recoveryAction, setRecoveryAction] = useState<
		"refresh" | "clear" | null
	>(null);
	const contributors = getContributors();
	const showUpdateCard = ["available", "downloading", "ready"].includes(status);
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
