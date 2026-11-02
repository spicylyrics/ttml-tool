import { Dismiss24Regular, Search24Regular } from "@fluentui/react-icons";
import {
	Button,
	Dialog,
	Heading,
	IconButton,
	Tabs,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { VisuallyHidden } from "radix-ui";
import {
	Fragment,
	memo,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { EmptyState } from "$/components/EmptyState";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs.ts";
import {
	applySearchVisibility,
	clearSearchVisibility,
	collectPageElements,
	ROW_SELECTOR,
} from "../logic/page-snapshot";
import {
	isSearchQuery,
	type PageSnapshot,
	pickActivePage,
	sameSnapshots,
	searchSettingsPages,
} from "../logic/search";
import {
	matchesSettingsSearch,
	settingsSearchKeywords,
} from "../logic/settings-search";
import { getSettingsPages, resolveSettingsPage } from "./pages";
import styles from "./settings.module.css";

function pageBody(pane: Element, value: string) {
	return pane.querySelector(`[data-settings-page-body="${value}"]`);
}

/**
 * Every page as a tab panel. While searching, the searchable ones stay mounted
 * (the inactive ones hidden) so their rows can be read and filtered. Memoized
 * on that flag alone so typing in the search box doesn't re-render every page.
 */
const SettingsPages = memo(({ forceMount }: { forceMount: boolean }) => {
	const { t } = useTranslation();
	const pages = useMemo(() => getSettingsPages(t), [t]);
	return (
		<>
			{pages.map(({ value, label, searchText, Content }) => (
				<Tabs.Content
					key={value}
					value={value}
					forceMount={(forceMount && searchText) || undefined}
					className={styles.tabContent}
				>
					<div className={styles.page}>
						<Heading as="h2" size="7" className={styles.pageTitle}>
							{label}
						</Heading>
						<div className={styles.pageBody} data-settings-page-body={value}>
							<Content />
						</div>
					</div>
				</Tabs.Content>
			))}
		</>
	);
});

export const SettingsDialog = memo(() => {
	const [open, setOpen] = useAtom(settingsDialogAtom);
	const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
	const [query, setQuery] = useState("");
	// Only a click fades the new pane in. Arrow keys, search and the first
	// open swap instantly: they repeat too often for motion to be anything but drag.
	const [instantTab, setInstantTab] = useState(true);
	const tabPointerRef = useRef(false);
	const searchRef = useRef<HTMLInputElement>(null);
	const contentRef = useRef<HTMLElement>(null);
	const { t } = useTranslation();
	const displayedTab = resolveSettingsPage(activeTab);
	const pages = useMemo(() => getSettingsPages(t), [t]);
	const searchablePages = useMemo(
		() =>
			pages.map((page) => ({
				value: page.value,
				label: page.label,
				keywords: settingsSearchKeywords[page.value] ?? "",
			})),
		[pages],
	);
	const textPages = useMemo(
		() => pages.filter((page) => page.searchText),
		[pages],
	);
	const searching = open && isSearchQuery(query);

	// What every page renders, read while searching. Force-mounted panels fill
	// in a commit later (and some sections load async), so re-read on changes.
	const [snapshots, setSnapshots] = useState<Record<
		string,
		PageSnapshot
	> | null>(null);
	useLayoutEffect(() => {
		const pane = contentRef.current;
		if (!searching || !pane) {
			setSnapshots(null);
			return;
		}
		const read = () => {
			const next: Record<string, PageSnapshot> = {};
			for (const page of textPages) {
				const body = pageBody(pane, page.value);
				// Not filled in yet: stay null so the tab jump doesn't act on
				// keyword-only results.
				if (!body?.childElementCount) return;
				next[page.value] = collectPageElements(body).snapshot;
			}
			setSnapshots((prev) => (sameSnapshots(prev, next) ? prev : next));
		};
		read();
		const observer = new MutationObserver(read);
		observer.observe(pane, {
			childList: true,
			subtree: true,
			characterData: true,
		});
		return () => observer.disconnect();
	}, [searching, textPages]);

	const results = useMemo(
		() => searchSettingsPages(searchablePages, snapshots, query),
		[searchablePages, snapshots, query],
	);
	const resultByPage = useMemo(
		() => new Map(results.map((result) => [result.value, result])),
		[results],
	);
	const visiblePages = pages.filter(
		(page) => resultByPage.get(page.value)?.visible,
	);
	// Wait for the pages' text, or a text-only match flashes "nothing found".
	const nothingFound =
		searching && snapshots !== null && visiblePages.length === 0;

	// Hide the rows a search filters out. Only attributes change, which the
	// observer above ignores, so this can't loop.
	useLayoutEffect(() => {
		const pane = contentRef.current;
		if (!pane) return;
		if (!searching || !snapshots) {
			clearSearchVisibility(pane);
			return;
		}
		for (const result of results) {
			const body = pageBody(pane, result.value);
			if (!body) continue;
			const elements = collectPageElements(body);
			applySearchVisibility(elements.rows, result.rows);
			applySearchVisibility(elements.groups, result.groups);
		}
	}, [searching, snapshots, results]);

	useEffect(() => {
		if (!open) {
			setQuery("");
			setInstantTab(true);
			return;
		}
		if (!searching || !snapshots) return;
		const next = pickActivePage(displayedTab, results);
		if (next !== displayedTab) setActiveTab(next);
	}, [open, searching, snapshots, results, displayedTab, setActiveTab]);

	// Bring the best match on the open page into view and ring it, once the
	// pages have rendered and been filtered.
	useEffect(() => {
		if (!searching || !snapshots) return;
		let target: HTMLElement | undefined;
		const frame = requestAnimationFrame(() => {
			const pane = contentRef.current;
			if (!pane) return;
			pane.scrollTop = 0;
			const body = pageBody(pane, displayedTab);
			if (!body) return;
			const match = Array.from(
				body.querySelectorAll<HTMLElement>(
					"h1, h2, h3, h4, label, p, span, button",
				),
			)
				.filter(
					(element) =>
						element.getClientRects().length &&
						matchesSettingsSearch(element.textContent ?? "", query),
				)
				.sort(
					(a, b) => (a.textContent?.length ?? 0) - (b.textContent?.length ?? 0),
				)[0];
			if (!match) return;
			target = match.closest<HTMLElement>(ROW_SELECTOR) ?? match;
			target.setAttribute("data-search-match", "");
			target.scrollIntoView({ block: "nearest", behavior: "instant" });
		});
		return () => {
			cancelAnimationFrame(frame);
			target?.removeAttribute("data-search-match");
		};
	}, [searching, displayedTab, query, snapshots]);

	const clearSearch = () => {
		setQuery("");
		searchRef.current?.focus();
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content
				maxWidth="1040px"
				className={styles.dialogContent}
				aria-describedby={undefined}
				onEscapeKeyDown={(event) => {
					// The first Escape in a filled search box clears it; the next closes.
					if (query && document.activeElement === searchRef.current) {
						event.preventDefault();
						setQuery("");
					}
				}}
			>
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
							value={query}
							onChange={(event) => {
								setQuery(event.target.value);
								setInstantTab(true);
							}}
							placeholder={t("settingsDialog.search", "Search settings")}
							aria-label={t("settingsDialog.search", "Search settings")}
						>
							<TextField.Slot>
								<Search24Regular width="18" height="18" />
							</TextField.Slot>
							{query && (
								<TextField.Slot side="right">
									<IconButton
										size="1"
										variant="ghost"
										color="gray"
										aria-label={t("settingsDialog.clearSearch", "Clear search")}
										onClick={clearSearch}
									>
										<Dismiss24Regular width="16" height="16" />
									</IconButton>
								</TextField.Slot>
							)}
						</TextField.Root>
						<Tabs.List
							className={styles.navigation}
							aria-label={t("settingsDialog.title", "Preferences")}
							onPointerDown={() => {
								tabPointerRef.current = true;
							}}
							// Capture: the trigger moves focus, and so the tab, in its own keydown.
							onKeyDownCapture={() => {
								tabPointerRef.current = false;
							}}
						>
							{visiblePages.map((page, index) => {
								const count = resultByPage.get(page.value)?.matchCount ?? 0;
								// Clusters are told apart by space alone while browsing;
								// search results run as one list.
								const newCluster =
									!searching &&
									index > 0 &&
									visiblePages[index - 1].cluster !== page.cluster;
								return (
									<Fragment key={page.value}>
										{newCluster && (
											<span className={styles.clusterGap} aria-hidden="true" />
										)}
										<Tabs.Trigger
											value={page.value}
											className={styles.navigationItem}
										>
											<span
												className={styles.navigationIcon}
												aria-hidden="true"
											>
												{page.icon}
											</span>
											<span className={styles.navigationLabel}>
												{page.label}
											</span>
											{searching && count > 0 && (
												<span className={styles.count}>
													<span aria-hidden="true">{count}</span>
													<VisuallyHidden.Root>
														{t(
															"settingsDialog.matchCount",
															"Matching settings: {count}",
															{ count },
														)}
													</VisuallyHidden.Root>
												</span>
											)}
										</Tabs.Trigger>
									</Fragment>
								);
							})}
						</Tabs.List>
					</aside>

					<main
						ref={contentRef}
						className={styles.contentPane}
						data-instant={instantTab || undefined}
						data-empty={nothingFound || undefined}
					>
						<Dialog.Close>
							<IconButton
								variant="ghost"
								color="gray"
								className={styles.close}
								aria-label={t("common.close", "Close")}
							>
								<Dismiss24Regular width="20" height="20" />
							</IconButton>
						</Dialog.Close>
						{/* Always rendered, so screen readers hear it when it fills. */}
						<div role="status">
							{nothingFound && (
								<EmptyState
									icon={<Search24Regular />}
									title={t(
										"settingsDialog.noResults",
										'No settings match "{query}"',
										{ query: query.trim() },
									)}
									description={t(
										"settingsDialog.noResultsDesc",
										"Try another word, or clear the search.",
									)}
									actions={
										<Button variant="soft" color="gray" onClick={clearSearch}>
											{t("settingsDialog.clearSearch", "Clear search")}
										</Button>
									}
									className={styles.empty}
								/>
							)}
						</div>
						<SettingsPages forceMount={searching} />
					</main>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
});
