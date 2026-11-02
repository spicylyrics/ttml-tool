import {
	Dismiss16Regular,
	Maximize16Regular,
	SquareMultiple16Regular,
	Subtract16Regular,
} from "@fluentui/react-icons";
import { useTranslation } from "react-i18next";
import type { SystemControlProps } from "./index.tsx";
import styles from "./linux.module.css";
import { useWindowMaximized } from "./linux-title-bar.ts";
import { ResizeEdges } from "./ResizeEdges.tsx";

/** Round buttons like GNOME's and KDE's, for the Flatpak's own title bar. */
export function LinuxSystemControls(props: SystemControlProps) {
	const { t } = useTranslation();
	const maximized = useWindowMaximized(true);
	const maximizeLabel = maximized
		? t("app.window.restore", "Restore window")
		: t("app.window.maximize", "Maximize window");

	return (
		<div className={styles.controls}>
			{!maximized && <ResizeEdges />}
			<button
				type="button"
				className={styles.button}
				aria-label={t("app.window.minimize", "Minimize window")}
				title={t("app.window.minimize", "Minimize window")}
				onClick={props.onMinimized}
			>
				<Subtract16Regular />
			</button>
			<button
				type="button"
				className={styles.button}
				aria-label={maximizeLabel}
				title={maximizeLabel}
				onClick={props.onMaximized}
			>
				{maximized ? <SquareMultiple16Regular /> : <Maximize16Regular />}
			</button>
			<button
				type="button"
				className={styles.button}
				aria-label={t("app.window.close", "Close window")}
				title={t("app.window.close", "Close window")}
				onClick={props.onClosed}
			>
				<Dismiss16Regular />
			</button>
		</div>
	);
}
