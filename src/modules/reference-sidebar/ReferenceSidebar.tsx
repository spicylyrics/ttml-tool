import {
	DocumentText20Regular,
	ErrorCircle20Regular,
	Eye20Regular,
	PanelRightContract20Regular,
} from "@fluentui/react-icons";
import { IconButton, Text } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { type ReactNode, Suspense, useEffect, useId, useRef } from "react";
import { useTranslation } from "react-i18next";
import { ActionTooltip } from "$/components/ActionTooltip";
import { PreviewModeSwitcher } from "$/components/PreviewModeSwitcher";
import { ResizablePanel } from "$/components/ResizablePanel";
import SuspensePlaceHolder from "$/components/SuspensePlaceHolder";
import { PreviewModeControl } from "$/modules/settings/components/WorkflowControls";
import { showPreviewPanelAtom, ToolMode, toolModeAtom } from "$/states/main";
import { lazy } from "$/utils/lazy.ts";
import {
	REFERENCE_SIDEBAR_MAX_WIDTH,
	REFERENCE_SIDEBAR_MIN_WIDTH,
	type ReferenceSidebarTab,
} from "./project-memory";
import styles from "./ReferenceSidebar.module.css";
import {
	applyPreviewPanelSwitchAtom,
	referenceSidebarEnabledAtom,
	referenceSidebarOpenAtom,
	referenceSidebarStateAtom,
	referenceSidebarTabsAtom,
	referenceSidebarVisibleTabAtom,
	referenceSidebarWidthAtom,
	toggleReferenceSidebarTabAtom,
} from "./states";

const GeniusReferenceTab = lazy(() => import("./GeniusReferenceTab"));

const TAB_ICONS: Record<ReferenceSidebarTab, ReactNode> = {
	preview: <Eye20Regular />,
	genius: <DocumentText20Regular />,
	problems: <ErrorCircle20Regular />,
};

const useTabLabel = () => {
	const { t } = useTranslation();
	return (tab: ReferenceSidebarTab) => {
		switch (tab) {
			case "preview":
				return t("referenceSidebar.tabs.preview", "Preview");
			case "genius":
				return t("referenceSidebar.tabs.genius", "Genius");
			case "problems":
				return t("referenceSidebar.tabs.problems", "Problems");
		}
	};
};

/**
 * Only the open tab is mounted. Collapsed, or on another tab, the preview is
 * unmounted, so it adds no work to edits or key presses.
 */
const TabContent = ({ tab }: { tab: ReferenceSidebarTab }) => {
	switch (tab) {
		case "preview":
			return (
				<div className={styles.body}>
					<PreviewModeSwitcher />
				</div>
			);
		case "genius":
			return (
				<div className={`${styles.body} ${styles.padded}`}>
					<Suspense fallback={<SuspensePlaceHolder />}>
						<GeniusReferenceTab />
					</Suspense>
				</div>
			);
		case "problems":
			// Extension point: the linter's findings go here once it lands.
			return null;
	}
};

const SidebarPanel = ({
	tab,
	panelId,
}: {
	tab: ReferenceSidebarTab;
	panelId: string;
}) => {
	const { t } = useTranslation();
	const tabLabel = useTabLabel();
	const setState = useSetAtom(referenceSidebarStateAtom);
	const collapseLabel = t("referenceSidebar.collapse", "Collapse sidebar");

	return (
		<section id={panelId} className={styles.panel} aria-label={tabLabel(tab)}>
			<div className={styles.header}>
				<Text size="2" weight="medium" truncate className={styles.title}>
					{tabLabel(tab)}
				</Text>
				{tab === "preview" && <PreviewModeControl />}
				<ActionTooltip label={collapseLabel} side="left">
					<IconButton
						size="1"
						variant="ghost"
						color="gray"
						aria-label={collapseLabel}
						onClick={() => setState({ open: false })}
					>
						<PanelRightContract20Regular />
					</IconButton>
				</ActionTooltip>
			</div>
			<TabContent tab={tab} />
		</section>
	);
};

const SidebarRail = ({ panelId }: { panelId: string }) => {
	const { t } = useTranslation();
	const tabLabel = useTabLabel();
	const tabs = useAtomValue(referenceSidebarTabsAtom);
	const open = useAtomValue(referenceSidebarOpenAtom);
	const visibleTab = useAtomValue(referenceSidebarVisibleTabAtom);
	const toggle = useSetAtom(toggleReferenceSidebarTabAtom);

	return (
		<div
			className={styles.rail}
			role="toolbar"
			aria-orientation="vertical"
			aria-label={t("referenceSidebar.label", "Reference sidebar")}
		>
			{tabs.map((tab) => {
				const active = open && visibleTab === tab;
				return (
					<ActionTooltip
						key={tab}
						label={tabLabel(tab)}
						description={
							active
								? t("referenceSidebar.collapse", "Collapse sidebar")
								: undefined
						}
						side="left"
					>
						<IconButton
							size="2"
							variant={active ? "soft" : "ghost"}
							color={active ? undefined : "gray"}
							aria-label={tabLabel(tab)}
							aria-pressed={active}
							aria-controls={active ? panelId : undefined}
							onClick={() => toggle(tab)}
						>
							{TAB_ICONS[tab]}
						</IconButton>
					</ActionTooltip>
				);
			})}
		</div>
	);
};

/** Lets the old "Preview panel" switch open and close the Preview tab. */
const usePreviewPanelSwitch = () => {
	const showPreviewPanel = useAtomValue(showPreviewPanelAtom);
	const apply = useSetAtom(applyPreviewPanelSwitchAtom);
	const previous = useRef(showPreviewPanel);
	useEffect(() => {
		if (previous.current === showPreviewPanel) return;
		previous.current = showPreviewPanel;
		apply(showPreviewPanel);
	}, [apply, showPreviewPanel]);
};

const ReferenceSidebarDock = () => {
	const open = useAtomValue(referenceSidebarOpenAtom);
	const tab = useAtomValue(referenceSidebarVisibleTabAtom);
	const panelId = useId();
	usePreviewPanelSwitch();

	return (
		<div className={styles.dock}>
			{open && (
				<ResizablePanel
					widthAtom={referenceSidebarWidthAtom}
					minWidth={REFERENCE_SIDEBAR_MIN_WIDTH}
					maxWidth={REFERENCE_SIDEBAR_MAX_WIDTH}
				>
					<SidebarPanel tab={tab} panelId={panelId} />
				</ResizablePanel>
			)}
			<SidebarRail panelId={panelId} />
		</div>
	);
};

/**
 * Docked reference sidebar on the right of the editor (Preview, Genius, and
 * later Problems). Renders nothing while its flag is off, and only shows in
 * Edit and Time mode: Preview mode already shows the preview full size.
 */
export const ReferenceSidebar = () => {
	const enabled = useAtomValue(referenceSidebarEnabledAtom);
	const toolMode = useAtomValue(toolModeAtom);
	if (!enabled || (toolMode !== ToolMode.Edit && toolMode !== ToolMode.Sync))
		return null;
	return <ReferenceSidebarDock />;
};

export default ReferenceSidebar;
