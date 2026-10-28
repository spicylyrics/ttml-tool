import { Dismiss24Regular, Search24Regular } from "@fluentui/react-icons";
import { Button, Dialog, IconButton, Text, TextField } from "@radix-ui/themes";
import { useAtom } from "jotai";
import { Tabs, VisuallyHidden } from "radix-ui";
import {
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
import { matchesSettingsSearch } from "../logic/settings-search";
import styles from "./PreferencesShell.module.css";
import { resolveShellPage } from "./page-map";
import {
	applySearchVisibility,
	clearSearchVisibility,
	collectPageElements,
} from "./page-snapshot";
import { getShellPages, ShellPages } from "./pages";
import {
	isSearchQuery,
	type PageSnapshot,
	pickActivePage,
	sameSnapshots,
	searchSettingsPages,
} from "./search";

function pageBody(pane: Element, value: string) {
	return pane.querySelector(`[data-shell-page-body="${value}"]`);
}

/**
 * Preferences, new layout: the title, search and close button across the top,
 * a sidebar whose labels wrap (long locales overflowed the classic one), and
 * the existing pages unchanged as the content. A search filters each page down
 * to its matching rows instead of only picking a tab.
 */
export const PreferencesShell = memo(() => {
	const [open, setOpen] = useAtom(settingsDialogAtom);
	const [activeTab, setActiveTab] = useAtom(settingsTabAtom);
	const [query, setQuery] = useState("");
	const searchRef = useRef<HTMLInputElement>(null);
	const contentRef = useRef<HTMLElement>(null);
	const { t } = useTranslation();
	// Classic ids (and old ones) from deep links map onto the shell's pages.
	const displayedTab = resolveShellPage(activeTab);
	const pages = useMemo(() => getShellPages(t), [t]);
	const searchablePages = useMemo(
		() =>
			pages.map((page) => ({
				value: page.value,
				label: page.label,
				keywords: page.keywords,
			})),
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
			for (const page of searchablePages) {
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
	}, [searching, searchablePages]);

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
			return;
		}
		if (!searching || !snapshots) return;
		const next = pickActivePage(displayedTab, results);
		if (next !== displayedTab) setActiveTab(next);
	}, [open, searching, snapshots, results, displayedTab, setActiveTab]);

	// Bring the best match on the open page into view and mark it, once the
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
			target = match.closest<HTMLElement>(".rt-Card") ?? match;
			target.setAttribute("data-shell-search-match", "");
			target.scrollIntoView({ block: "nearest", behavior: "instant" });
		});
		return () => {
			cancelAnimationFrame(frame);
			target?.removeAttribute("data-shell-search-match");
		};
	}, [searching, displayedTab, query, snapshots]);

	const clearSearch = () => {
		setQuery("");
		searchRef.current?.focus();
	};

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content
				maxWidth="1080px"
				className={styles.dialog}
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
					onValueChange={setActiveTab}
					orientation="vertical"
					className={styles.root}
				>
					<header className={styles.header}>
						<Dialog.Title size="4" className={styles.title}>
							{t("settingsDialog.title", "Preferences")}
						</Dialog.Title>
						<TextField.Root
							ref={searchRef}
							size="2"
							className={styles.search}
							value={query}
							onChange={(event) => setQuery(event.target.value)}
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
					</header>

					<div className={styles.body}>
						<aside className={styles.sidebar}>
							<Tabs.List
								className={styles.navigation}
								aria-label={t("settingsDialog.title", "Preferences")}
							>
								{visiblePages.map((page) => {
									const count = resultByPage.get(page.value)?.matchCount ?? 0;
									return (
										<Tabs.Trigger
											key={page.value}
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
															"preferencesShell.matchCount",
															"Matching settings: {count}",
															{ count },
														)}
													</VisuallyHidden.Root>
												</span>
											)}
										</Tabs.Trigger>
									);
								})}
							</Tabs.List>
							{nothingFound && (
								<Text
									size="2"
									color="gray"
									role="status"
									className={styles.noResults}
								>
									{t(
										"settingsDialog.noSearchResults",
										"No matching categories",
									)}
								</Text>
							)}
						</aside>

						<main
							ref={contentRef}
							className={styles.content}
							data-empty={nothingFound || undefined}
						>
							{nothingFound && (
								<EmptyState
									icon={<Search24Regular />}
									title={t(
										"preferencesShell.noResults",
										'No settings match "{query}"',
										{ query: query.trim() },
									)}
									description={t(
										"preferencesShell.noResultsDesc",
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
							<ShellPages forceMount={searching} />
						</main>
					</div>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
});
