import {
	ChevronDownRegular,
	ChevronRightRegular,
	OpenRegular,
	SparkleRegular,
} from "@fluentui/react-icons";
import { Badge, Box, Button, Flex, Heading, Text } from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-shell";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChangeMarkdown } from "$/components/Dialogs/change-notes.tsx";
import { OptionPicker } from "$/components/OptionPicker";
import changelog from "$/data/changelog.json";
import legacy from "$/data/changelog-legacy.json";
import styles from "./ChangelogScreen.module.css";
import {
	buildReleaseCards,
	type ChangeEntry,
	type ChangeSection,
	groupReleaseCards,
	type ReleaseCard,
	type ReleaseGroup,
} from "./model";

type View = "all" | "highlights";

/** One line, as in the release notes: "**Lead.** Explanation". */
function EntryText({ entry }: { entry: ChangeEntry }) {
	const lead =
		entry.body && !/[.!?:]$/.test(entry.title)
			? `${entry.title}.`
			: entry.title;
	return (
		<Text as="p" size="2" className={styles.entry}>
			<Text weight="bold">
				<ChangeMarkdown text={lead} />
			</Text>
			{entry.body && (
				<>
					{" "}
					<Text color="gray">
						<ChangeMarkdown text={entry.body} />
					</Text>
				</>
			)}
		</Text>
	);
}

function formatDate(date: string | undefined, language: string) {
	if (!date) return undefined;
	const parsed = new Date(`${date}T00:00:00Z`);
	if (Number.isNaN(parsed.getTime())) return date;
	try {
		return new Intl.DateTimeFormat(language, {
			dateStyle: "medium",
			timeZone: "UTC",
		}).format(parsed);
	} catch {
		return date;
	}
}

/** A release: one row while closed, a card with its notes while open. */
function ReleaseItem({
	card,
	latest,
	open,
	onToggle,
}: {
	card: ReleaseCard;
	latest: boolean;
	open: boolean;
	onToggle: () => void;
}) {
	const { t, i18n } = useTranslation();
	const sectionLabels: Record<ChangeSection, string> = {
		new: t("changelogScreen.sectionNew", "New"),
		changed: t("changelogScreen.sectionChanged", "Changed"),
		fixed: t("changelogScreen.sectionFixed", "Fixed"),
	};
	const date = formatDate(card.date, i18n.language);
	const title = card.version ? `v${card.version}` : card.summary;
	const Chevron = open ? ChevronDownRegular : ChevronRightRegular;
	return (
		<article
			id={`release-${card.key}`}
			className={styles.release}
			data-open={open || undefined}
			aria-label={title}
		>
			<button
				type="button"
				className={styles.releaseToggle}
				aria-expanded={open}
				onClick={onToggle}
			>
				<Chevron aria-hidden className={styles.chevron} />
				<Heading as="h3" size="3" className={styles.releaseHeading}>
					{title}
				</Heading>
				{latest && (
					<Badge color="green" variant="soft">
						{t("changelogScreen.latest", "Latest")}
					</Badge>
				)}
				{card.version && card.summary && (
					<Text size="2" color="gray" className={styles.summary}>
						{card.summary}
					</Text>
				)}
				{date && (
					<Text size="1" color="gray" className={styles.date}>
						<time dateTime={card.date}>{date}</time>
					</Text>
				)}
			</button>

			{open && (
				<div className={styles.releaseBody}>
					{card.highlights.length > 0 && (
						<Box className={styles.highlights} mb="3">
							<Flex align="center" gap="1" mb="2">
								<SparkleRegular aria-hidden className={styles.highlightIcon} />
								<Text size="2" weight="medium">
									{t("changelogScreen.highlights", "Highlights")}
								</Text>
							</Flex>
							<Flex direction="column" gap="2">
								{card.highlights.map((entry) => (
									<EntryText
										key={`${entry.title}:${entry.body ?? ""}`}
										entry={entry}
									/>
								))}
							</Flex>
						</Box>
					)}

					{card.sections.map(({ section, entries }) => (
						<Box key={section} className={styles.section}>
							<Heading
								as="h4"
								size="2"
								mb="2"
								className={styles.sectionHeading}
							>
								{sectionLabels[section]}
							</Heading>
							<ul className={styles.list}>
								{entries.map((entry) => (
									<li key={`${entry.title}:${entry.body ?? ""}`}>
										<EntryText entry={entry} />
									</li>
								))}
							</ul>
						</Box>
					))}
				</div>
			)}
		</article>
	);
}

const openCommits = async () => {
	const repoUrl = "https://github.com/spicylyrics/ttml-tool/commits/main";
	if (import.meta.env.TAURI_ENV_PLATFORM) {
		await open(repoUrl);
	} else {
		window.open(repoUrl, "_blank");
	}
};

const groupId = (group: ReleaseGroup) =>
	`release-group-${group.minor ?? "earlier"}`;

function scrollParentOf(element: HTMLElement | null) {
	for (let node = element?.parentElement; node; node = node.parentElement) {
		const { overflowY } = getComputedStyle(node);
		if (overflowY === "auto" || overflowY === "scroll") return node;
	}
	return null;
}

/**
 * The Changelog page in Preferences. A rail of minor versions on the left
 * jumps through the list; only the newest release starts open.
 */
export function ChangelogScreen() {
	const { t } = useTranslation();
	const [view, setView] = useState<View>("all");
	const groups = useMemo(
		() =>
			groupReleaseCards(
				buildReleaseCards(changelog, legacy, {
					highlightsOnly: view === "highlights",
				}),
			),
		[view],
	);
	const latestKey = groups[0]?.cards[0]?.key;
	const [openKeys, setOpenKeys] = useState<ReadonlySet<string>>(
		() => new Set(latestKey ? [latestKey] : []),
	);
	const [activeGroup, setActiveGroup] = useState(groups[0]?.minor);
	const listRef = useRef<HTMLDivElement>(null);

	const toggle = (key: string) =>
		setOpenKeys((keys) => {
			const next = new Set(keys);
			if (!next.delete(key)) next.add(key);
			return next;
		});

	const jumpTo = (group: ReleaseGroup) => {
		const first = group.cards[0];
		if (first) setOpenKeys((keys) => new Set(keys).add(first.key));
		setActiveGroup(group.minor);
		// After the open release renders, so the jump lands on its final spot.
		requestAnimationFrame(() =>
			document
				.getElementById(groupId(group))
				?.scrollIntoView({ block: "start", behavior: "instant" }),
		);
	};

	// Marks the group whose top has passed the top of the scrolling pane.
	useEffect(() => {
		const scroller = scrollParentOf(listRef.current);
		if (!scroller) return;
		let frame = 0;
		const update = () => {
			frame = 0;
			const top = scroller.getBoundingClientRect().top + 24;
			let current = groups[0]?.minor;
			for (const group of groups) {
				const element = document.getElementById(groupId(group));
				if (!element || element.getBoundingClientRect().top > top) break;
				current = group.minor;
			}
			setActiveGroup(current);
		};
		const onScroll = () => {
			if (!frame) frame = requestAnimationFrame(update);
		};
		scroller.addEventListener("scroll", onScroll, { passive: true });
		return () => {
			scroller.removeEventListener("scroll", onScroll);
			cancelAnimationFrame(frame);
		};
	}, [groups]);

	const earlier = t("changelogScreen.earlier", "Earlier");

	return (
		<Flex direction="column" gap="3">
			<Flex justify="between" align="center" gap="2" wrap="wrap">
				<OptionPicker<View>
					variant="segmented"
					label={t("changelogScreen.viewLabel", "Show")}
					value={view}
					onValueChange={setView}
					options={[
						{
							value: "all",
							label: t("changelogScreen.viewAll", "Everything"),
						},
						{
							value: "highlights",
							label: t("changelogScreen.viewHighlights", "Highlights"),
						},
					]}
				/>
				<Button variant="soft" size="1" onClick={openCommits}>
					<OpenRegular aria-hidden />
					{t("changeNotes.viewCommits", "View Commits on GitHub")}
				</Button>
			</Flex>

			{groups.length ? (
				<div className={styles.layout}>
					<nav
						className={styles.rail}
						aria-label={t("changelogScreen.versions", "Versions")}
					>
						<ol>
							{groups.map((group) => (
								<li key={group.minor ?? "earlier"}>
									<button
										type="button"
										className={styles.railItem}
										aria-current={
											group.minor === activeGroup ? "location" : undefined
										}
										onClick={() => jumpTo(group)}
									>
										{group.minor ?? earlier}
									</button>
								</li>
							))}
						</ol>
					</nav>
					<div ref={listRef} className={styles.releases}>
						{groups.map((group) => (
							<section
								key={group.minor ?? "earlier"}
								id={groupId(group)}
								className={styles.group}
								aria-label={group.minor ?? earlier}
							>
								{group.cards.map((card) => (
									<ReleaseItem
										key={card.key}
										card={card}
										latest={card.version === changelog[0]?.version}
										open={openKeys.has(card.key)}
										onToggle={() => toggle(card.key)}
									/>
								))}
							</section>
						))}
					</div>
				</div>
			) : (
				<Text size="2" color="gray">
					{t("changelogScreen.empty", "No releases to show.")}
				</Text>
			)}
		</Flex>
	);
}
