import {
	Dismiss24Regular,
	Edit24Regular,
	Folder24Regular,
	Info24Regular,
	Keyboard12324Regular,
	PaintBrush24Regular,
	Search24Regular,
	Settings24Regular,
	Speaker224Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Dialog,
	Flex,
	Heading,
	IconButton,
	Tabs,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import {
	memo,
	type ReactNode,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs.ts";
import {
	matchesSettingsPage,
	matchesSettingsSearch,
	settingsSearchKeywords,
} from "../logic/settings-search";
import { ShellFlagToggle } from "../shell/ShellFlagToggle";
import { SettingsAboutTab } from "./about";
import { SettingsAppearanceTab } from "./appearance";
import { AudioSettingsTab } from "./audio";
import { SettingsBackupTab } from "./backup";
import { SettingsCommonTab } from "./common";
import { SettingsKeyBindingsDialog } from "./keybindings";
import styles from "./settings.module.css";
import { SettingsSpectrogramTab } from "./spectrogram";

const SettingsPage = ({
	title,
	description,
	children,
}: {
	title: string;
	description?: string;
	children: ReactNode;
}) => (
	<Flex direction="column" gap="4" className={styles.page}>
		<Box>
			<Heading size="7">{title}</Heading>
			{description && (
				<Text size="2" color="gray">
					{description}
				</Text>
			)}
		</Box>
		{children}
	</Flex>
);

const NavigationItem = ({
	value,
	icon,
	children,
}: {
	value: string;
	icon: ReactNode;
	children: ReactNode;
}) => (
	<Tabs.Trigger value={value} className={styles.navigationItem}>
		{icon}
		<span>{children}</span>
	</Tabs.Trigger>
);

/**
 * Every page, as tab panels. While searching, all of them stay mounted (the
 * inactive ones hidden) so their text can be matched. Memoized on that flag
 * alone so typing in the search box doesn't re-render seven pages.
 */
const SettingsPages = memo(({ forceMount }: { forceMount: boolean }) => {
	const { t } = useTranslation();
	const mount = forceMount || undefined;
	return (
		<>
			<Tabs.Content
				value="common"
				forceMount={mount}
				className={styles.tabContent}
			>
				<SettingsPage
					title={t("settingsDialog.tab.common", "General")}
					description={t(
						"settingsDialog.page.generalDesc",
						"Language, privacy, and app-wide behavior.",
					)}
				>
					<SettingsCommonTab section="general" />
				</SettingsPage>
			</Tabs.Content>
			<Tabs.Content
				value="editor"
				forceMount={mount}
				className={styles.tabContent}
			>
				<SettingsPage
					title={t("settingsDialog.tab.editor", "Editor & sync")}
					description={t(
						"settingsDialog.page.editorDesc",
						"Timing input, synchronization behavior, and visual cues.",
					)}
				>
					<SettingsCommonTab section="editor" />
				</SettingsPage>
			</Tabs.Content>
			<Tabs.Content
				value="files"
				forceMount={mount}
				className={styles.tabContent}
			>
				<SettingsPage
					title={t("settingsDialog.tab.files", "Files & storage")}
					description={t(
						"settingsDialog.page.filesDesc",
						"Import cleanup, autosave history, and portable backups.",
					)}
				>
					<SettingsCommonTab section="files" />
					<SettingsBackupTab />
				</SettingsPage>
			</Tabs.Content>
			<Tabs.Content
				value="audio"
				forceMount={mount}
				className={styles.tabContent}
			>
				<SettingsPage
					title={t("settingsDialog.tab.audio", "Audio")}
					description={t(
						"settingsDialog.page.audioDesc",
						"Playback, equalizer, and spectrogram display.",
					)}
				>
					<SettingsCommonTab section="audio" />
					<AudioSettingsTab />
					<SettingsSpectrogramTab />
				</SettingsPage>
			</Tabs.Content>
			<Tabs.Content
				value="keybinding"
				forceMount={mount}
				className={styles.tabContent}
			>
				<SettingsPage title={t("settingsDialog.tab.keybindings", "Shortcuts")}>
					<SettingsKeyBindingsDialog />
				</SettingsPage>
			</Tabs.Content>
			<Tabs.Content
				value="appearance"
				forceMount={mount}
				className={styles.tabContent}
			>
				<SettingsPage title={t("settingsDialog.tab.appearance", "Appearance")}>
					<SettingsAppearanceTab />
				</SettingsPage>
			</Tabs.Content>
			<Tabs.Content
				value="about"
				forceMount={mount}
				className={styles.tabContent}
			>
				<SettingsPage title={t("common.about", "About")}>
					<SettingsAboutTab />
				</SettingsPage>
			</Tabs.Content>
		</>
	);
});

export const SettingsDialog = memo(() => {
	const [settingsDialogOpen, setSettingsDialogOpen] =
		useAtom(settingsDialogAtom);
	const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
	const [searchQuery, setSearchQuery] = useState("");
	// Only a click fades the new pane in. Arrow keys, search and the first
	// open swap instantly: they repeat too often for motion to be anything but drag.
	const [instantTab, setInstantTab] = useState(true);
	const tabPointerRef = useRef(false);
	const searchRef = useRef<HTMLInputElement>(null);
	const contentRef = useRef<HTMLElement>(null);
	const { t } = useTranslation();
	const displayedTab = ["assistant", "ai", "dev"].includes(activeTab)
		? "common"
		: activeTab;
	const navigationItems = useMemo(
		() => [
			{
				value: "common",
				icon: <Settings24Regular />,
				label: t("settingsDialog.tab.common", "General"),
			},
			{
				value: "editor",
				icon: <Edit24Regular />,
				label: t("settingsDialog.tab.editor", "Editor & sync"),
			},
			{
				value: "files",
				icon: <Folder24Regular />,
				label: t("settingsDialog.tab.files", "Files & storage"),
			},
			{
				value: "audio",
				icon: <Speaker224Regular />,
				label: t("settingsDialog.tab.audio", "Audio"),
			},
			{
				value: "keybinding",
				icon: <Keyboard12324Regular />,
				label: t("settingsDialog.tab.keybindings", "Shortcuts"),
			},
			{
				value: "appearance",
				icon: <PaintBrush24Regular />,
				label: t("settingsDialog.tab.appearance", "Appearance"),
			},
			{
				value: "about",
				icon: <Info24Regular />,
				label: t("common.about", "About"),
			},
		],
		[t],
	);
	const searching = settingsDialogOpen && searchQuery.trim() !== "";
	// Rendered text of every page while searching. Force-mounted panels fill in
	// a commit later (and some sections load async), so re-read on DOM changes.
	const [pageTexts, setPageTexts] = useState<Record<string, string> | null>(
		null,
	);
	useLayoutEffect(() => {
		const pane = contentRef.current;
		if (!searching || !pane) {
			setPageTexts(null);
			return;
		}
		const read = () => {
			const texts: Record<string, string> = {};
			for (const item of navigationItems) {
				const panel = pane.querySelector(`[id$="-content-${item.value}"]`);
				// Not filled in yet: stay null so the tab jump doesn't act on
				// keyword-only results.
				if (!panel?.childElementCount) return;
				texts[item.value] = panel.textContent ?? "";
			}
			setPageTexts((prev) =>
				prev &&
				navigationItems.every(({ value }) => prev[value] === texts[value])
					? prev
					: texts,
			);
		};
		read();
		const observer = new MutationObserver(read);
		observer.observe(pane, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		return () => observer.disconnect();
	}, [searching, navigationItems]);
	const visibleItems = useMemo(
		() =>
			navigationItems.filter((item) =>
				matchesSettingsPage(
					{
						label: item.label,
						keywords: settingsSearchKeywords[item.value],
						text: pageTexts?.[item.value],
					},
					searchQuery,
				),
			),
		[navigationItems, searchQuery, pageTexts],
	);

	useEffect(() => {
		if (!settingsDialogOpen) {
			setSearchQuery("");
			setInstantTab(true);
			return;
		}
		if (
			searching &&
			pageTexts &&
			visibleItems.length &&
			!visibleItems.some((item) => item.value === displayedTab)
		) {
			setActiveTab(visibleItems[0].value);
		}
	}, [
		settingsDialogOpen,
		searching,
		pageTexts,
		displayedTab,
		visibleItems,
		setActiveTab,
	]);

	useEffect(() => {
		if (!settingsDialogOpen || !searchQuery.trim()) return;
		let target: HTMLElement | undefined;
		const frame = requestAnimationFrame(() => {
			const content = contentRef.current?.querySelector(
				`[id$="-content-${displayedTab}"][data-state="active"]`,
			);
			if (!content) return;
			const matches = Array.from(
				content.querySelectorAll<HTMLElement>(
					"h1, h2, h3, h4, label, p, span, button",
				),
			)
				.filter(
					(element) =>
						element.getClientRects().length &&
						matchesSettingsSearch(element.textContent ?? "", searchQuery),
				)
				.sort(
					(a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0),
				);
			const match = matches[0];
			if (!match) return;
			target = match.closest<HTMLElement>(".rt-Card") ?? match;
			target.classList.add(styles.searchHighlight);
			target.scrollIntoView({ block: "center", behavior: "instant" });
		});
		return () => {
			cancelAnimationFrame(frame);
			target?.classList.remove(styles.searchHighlight);
		};
	}, [settingsDialogOpen, displayedTab, searchQuery]);

	return (
		<Dialog.Root open={settingsDialogOpen} onOpenChange={setSettingsDialogOpen}>
			<Dialog.Content maxWidth="980px" className={styles.dialogContent}>
				<Tabs.Root
					value={displayedTab}
					onValueChange={(value) => {
						setInstantTab(!tabPointerRef.current);
						setActiveTab(value);
					}}
					orientation="vertical"
					className={styles.settingsLayout}
				>
					<aside className={styles.sidebar}>
						<Dialog.Title className={styles.sidebarTitle}>
							{t("settingsDialog.title", "Preferences")}
						</Dialog.Title>
						<TextField.Root
							ref={searchRef}
							className={styles.searchField}
							value={searchQuery}
							onChange={(event) => {
								setSearchQuery(event.target.value);
								setInstantTab(true);
							}}
							placeholder={t("settingsDialog.search", "Search settings")}
							aria-label={t("settingsDialog.search", "Search settings")}
						>
							<TextField.Slot>
								<Search24Regular width="18" height="18" />
							</TextField.Slot>
							{searchQuery && (
								<TextField.Slot side="right">
									<IconButton
										size="1"
										variant="ghost"
										color="gray"
										aria-label={t("settingsDialog.clearSearch", "Clear search")}
										onClick={() => {
											setSearchQuery("");
											searchRef.current?.focus();
										}}
									>
										<Dismiss24Regular width="16" height="16" />
									</IconButton>
								</TextField.Slot>
							)}
						</TextField.Root>
						<Tabs.List
							className={styles.navigation}
							onPointerDown={() => {
								tabPointerRef.current = true;
							}}
							// Capture: the trigger moves focus, and so the tab, in its own keydown.
							onKeyDownCapture={() => {
								tabPointerRef.current = false;
							}}
						>
							{visibleItems.map((item) => (
								<NavigationItem
									key={item.value}
									value={item.value}
									icon={item.icon}
								>
									{item.label}
								</NavigationItem>
							))}
						</Tabs.List>
						{visibleItems.length === 0 && (
							<Text
								size="2"
								color="gray"
								role="status"
								className={styles.noResults}
							>
								{t("settingsDialog.noSearchResults", "No matching categories")}
							</Text>
						)}
						<Box mt="auto" pt="3" px="2">
							<ShellFlagToggle />
						</Box>
					</aside>

					<main
						ref={contentRef}
						className={styles.contentPane}
						data-instant={instantTab || undefined}
					>
						<SettingsPages forceMount={searching} />
					</main>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
});
