import {
	ArrowLeft16Regular,
	MusicNote2Regular,
	PersonSearch24Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Button,
	Checkbox,
	Dialog,
	Flex,
	Link,
	Spinner,
	Text,
	TextField,
} from "@radix-ui/themes";
import type { TFunction } from "i18next";
import { useAtom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { type FC, useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { EmptyState } from "$/components/EmptyState";
import { SelectablePanel } from "$/components/Panel";
import { getGuideUrl } from "$/modules/onboarding/logic";
import {
	metadataValues,
	setMetadataValues,
} from "$/modules/project/logic/metadata-fields";
import { geniusApiKeyAtom } from "$/modules/settings/states/index.ts";
import { songwriterFinderDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import { getGeniusKeyGuideUrl } from "$/utils/genius-guide";
import {
	isSameSong,
	lookUpWriters,
	type SongSearch,
	searchSongs,
} from "../logic/lookup";
import {
	addSongwriters,
	type FinderRow,
	isPreselected,
	mergeWriters,
	nameFor,
} from "../logic/merge";
import type { SongMatch, SongwriterSource, SourceResult } from "../logic/types";
import styles from "./SongwriterFinderDialog.module.css";

type View = "search" | "results" | "token";

const SOURCE_LABEL: Record<SongwriterSource, string> = {
	genius: "Genius",
	musicbrainz: "MusicBrainz",
};

const Cover: FC<{ match: SongMatch }> = ({ match }) => {
	// Many releases have no cover art; fall back to the note.
	const [failed, setFailed] = useState<string>();
	return match.coverUrl && failed !== match.coverUrl ? (
		<img
			className={styles.cover}
			src={match.coverUrl}
			alt=""
			referrerPolicy="no-referrer"
			onError={() => setFailed(match.coverUrl)}
		/>
	) : (
		<span className={styles.cover} aria-hidden>
			<MusicNote2Regular />
		</span>
	);
};

const SongSummary: FC<{ match: SongMatch }> = ({ match }) => (
	<Flex direction="column" className={styles.songText}>
		<Text size="2" weight="medium" truncate>
			{match.title}
		</Text>
		<Text size="1" color="gray" truncate>
			{[match.artist, match.album].filter(Boolean).join(", ")}
		</Text>
	</Flex>
);

const TokenSetup: FC<{ onDone: () => void }> = ({ onDone }) => {
	const { t } = useTranslation();
	const [, setGeniusApiKey] = useAtom(geniusApiKeyAtom);
	const [draft, setDraft] = useState("");
	return (
		<Flex direction="column" gap="3">
			<Text size="2">
				{t(
					"metadataDialog.fetchSongwriters.setupDesc",
					"To fetch songwriters, add your Genius access token (Genius calls it the Client Access Token). You can create one in the ",
				)}
				<Link
					href="https://genius.com/api-clients"
					target="_blank"
					rel="noopener noreferrer"
				>
					Genius
				</Link>
				{t(
					"metadataDialog.fetchSongwriters.setupDescEnd",
					" developer portal.",
				)}
			</Text>
			<Link
				size="2"
				href={getGeniusKeyGuideUrl()}
				target="_blank"
				rel="noopener noreferrer"
			>
				{t(
					"metadataDialog.fetchSongwriters.howToGetKey",
					"How to get a Genius access token",
				)}
			</Link>
			<Flex gap="2">
				<TextField.Root
					className={styles.grow}
					aria-label={t(
						"metadataDialog.fetchSongwriters.keyPlaceholder",
						"Paste your Genius access token",
					)}
					placeholder={t(
						"metadataDialog.fetchSongwriters.keyPlaceholder",
						"Paste your Genius access token",
					)}
					value={draft}
					onChange={(event) => setDraft(event.currentTarget.value)}
				/>
				<Button
					disabled={!draft.trim()}
					onClick={() => {
						setGeniusApiKey(draft.trim());
						onDone();
					}}
				>
					{t("common.save", "Save")}
				</Button>
			</Flex>
		</Flex>
	);
};

/** "Found on Genius and MusicBrainz", or what went wrong with each source. */
function sourceSummary(results: SourceResult[], t: TFunction): string {
	const found = results.filter((result) => result.writers.length > 0);
	const lines: string[] = [];
	if (found.length > 0) {
		lines.push(
			t("songwriterFinder.foundOn", "Found on {sources}.", {
				sources: found
					.map((result) => SOURCE_LABEL[result.source])
					.join(t("songwriterFinder.and", " and ")),
			}),
		);
	}
	for (const result of results) {
		if (result.writers.length > 0) continue;
		lines.push(
			result.error
				? t("songwriterFinder.sourceFailed", "{source} didn't answer.", {
						source: SOURCE_LABEL[result.source],
					})
				: t("songwriterFinder.sourceEmpty", "{source} has no credits for it.", {
						source: SOURCE_LABEL[result.source],
					}),
		);
	}
	return lines.join(" ");
}

export const SongwriterFinderDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(songwriterFinderDialogAtom);
	const geniusApiKey = useAtomValue(geniusApiKeyAtom);
	const setLyricLines = useSetImmerAtom(lyricLinesAtom);
	// Read on demand: subscribing would re-render this on every lyric edit.
	const store = useStore();

	const [view, setView] = useState<View>("search");
	const [title, setTitle] = useState("");
	const [artist, setArtist] = useState("");
	const [search, setSearch] = useState<SongSearch>();
	const [searching, setSearching] = useState(false);
	const [picked, setPicked] = useState<SongMatch>();
	const [results, setResults] = useState<SourceResult[]>();
	const [rows, setRows] = useState<FinderRow[]>([]);
	const [selected, setSelected] = useState<Set<string>>(new Set());
	const [useCredited, setUseCredited] = useState<Set<string>>(new Set());
	const runId = useRef(0);

	const pick = useCallback(
		async (match: SongMatch, songSearch: SongSearch) => {
			const id = ++runId.current;
			setPicked(match);
			setResults(undefined);
			setView("results");
			const found = await lookUpWriters(match, songSearch, geniusApiKey);
			if (id !== runId.current) return;
			const existing = metadataValues(
				store.get(lyricLinesAtom).metadata,
				"songwriter",
			);
			const merged = mergeWriters(found, existing);
			const withCredits = found.filter(
				(result) => result.writers.length > 0,
			).length;
			setResults(found);
			setRows(merged);
			setSelected(
				new Set(
					merged
						.filter((row) => isPreselected(row, withCredits))
						.map((row) => row.id),
				),
			);
			setUseCredited(new Set());
		},
		[geniusApiKey, store],
	);

	const runSearch = useCallback(
		async (songTitle: string, songArtist: string, autoPick: boolean) => {
			if (!songTitle.trim() && !songArtist.trim()) return;
			const id = ++runId.current;
			setView("search");
			setSearching(true);
			try {
				const found = await searchSongs(songTitle, songArtist, geniusApiKey);
				if (id !== runId.current) return;
				setSearch(found);
				const first = found.candidates[0];
				if (
					autoPick &&
					first &&
					isSameSong(first, { title: songTitle, artist: songArtist })
				) {
					void pick(first, found);
				}
			} finally {
				if (id === runId.current) setSearching(false);
			}
		},
		[geniusApiKey, pick],
	);

	// Start from the song in the metadata, and skip the list when the top
	// result is clearly that song.
	// biome-ignore lint/correctness/useExhaustiveDependencies: runs once per opening
	useEffect(() => {
		if (!open) return;
		const metadata = store.get(lyricLinesAtom).metadata;
		const songTitle = metadataValues(metadata, "musicName")[0] ?? "";
		const songArtist = metadataValues(metadata, "artists")[0] ?? "";
		setTitle(songTitle);
		setArtist(songArtist);
		setSearch(undefined);
		setPicked(undefined);
		setResults(undefined);
		setView("search");
		void runSearch(songTitle, songArtist, true);
		return () => {
			runId.current++;
		};
	}, [open]);

	const chosenNames = rows
		.filter((row) => selected.has(row.id) && !row.alreadyAdded)
		.map((row) => nameFor(row, !useCredited.has(row.id)));

	const apply = () => {
		const match = picked;
		setLyricLines((prev) => {
			const current = metadataValues(prev.metadata, "songwriter");
			setMetadataValues(
				prev.metadata,
				"songwriter",
				addSongwriters(current, chosenNames),
			);
			if (!match) return;
			const fillIfEmpty = (key: string, value?: string) => {
				if (!value) return;
				if (metadataValues(prev.metadata, key).some((v) => v.trim())) return;
				setMetadataValues(prev.metadata, key, [value]);
			};
			fillIfEmpty("musicName", match.title);
			fillIfEmpty("artists", match.artist);
			fillIfEmpty("album", match.album);
		});
		toast.success(
			t(
				"songwriterFinder.added",
				"{count, plural, one {Added # songwriter} other {Added # songwriters}}",
				{ count: chosenNames.length },
			),
		);
		setOpen(false);
	};

	const toggle = (set: Set<string>, id: string) => {
		const next = new Set(set);
		if (next.has(id)) next.delete(id);
		else next.add(id);
		return next;
	};

	const searchForm = (
		<form
			className={styles.searchForm}
			onSubmit={(event) => {
				event.preventDefault();
				void runSearch(title, artist, false);
			}}
		>
			<TextField.Root
				className={styles.grow}
				aria-label={t("songwriterFinder.songTitle", "Song title")}
				placeholder={t("songwriterFinder.songTitle", "Song title")}
				value={title}
				onChange={(event) => setTitle(event.currentTarget.value)}
			/>
			<TextField.Root
				className={styles.grow}
				aria-label={t("songwriterFinder.artist", "Artist")}
				placeholder={t("songwriterFinder.artist", "Artist")}
				value={artist}
				onChange={(event) => setArtist(event.currentTarget.value)}
			/>
			<Button
				type="submit"
				disabled={searching || (!title.trim() && !artist.trim())}
			>
				{searching ? <Spinner /> : <Search16Regular />}
				{t("common.search", "Search")}
			</Button>
		</form>
	);

	const searchView = (
		<>
			{searchForm}
			<div className={styles.list}>
				{searching ? (
					<Flex justify="center" p="6">
						<Spinner size="3" />
					</Flex>
				) : search && search.candidates.length > 0 ? (
					<Flex direction="column" gap="2">
						<Text size="1" color="gray">
							{t("songwriterFinder.pickSong", "Pick the song you're syncing.")}
						</Text>
						{search.candidates.slice(0, 10).map((match) => (
							<SelectablePanel
								key={`${match.source}-${match.id}`}
								className={styles.candidate}
								onClick={() => void pick(match, search)}
							>
								<Flex align="center" gap="3">
									<Cover match={match} />
									<SongSummary match={match} />
								</Flex>
							</SelectablePanel>
						))}
					</Flex>
				) : (
					<EmptyState
						icon={<PersonSearch24Regular />}
						title={
							search
								? t("songwriterFinder.noSongs", "No songs found")
								: t("songwriterFinder.startTitle", "Search for the song")
						}
						description={
							search
								? t(
										"songwriterFinder.noSongsHint",
										"Check the spelling, or search with just the title.",
									)
								: t(
										"songwriterFinder.startHint",
										"Enter the title and artist to look up who wrote it.",
									)
						}
					/>
				)}
			</div>
		</>
	);

	const loadingResults = !results;
	const resultsView = picked && (
		<>
			<div className={styles.match}>
				<Cover match={picked} />
				<SongSummary match={picked} />
				<Button
					variant="ghost"
					color="gray"
					className={styles.notThis}
					onClick={() => {
						runId.current++;
						setView("search");
						if (!search) void runSearch(title, artist, false);
					}}
				>
					{t("songwriterFinder.notThisSong", "Not this song?")}
				</Button>
			</div>
			{loadingResults ? (
				<Flex align="center" justify="center" gap="2" p="6">
					<Spinner />
					<Text size="2" color="gray">
						{t("songwriterFinder.lookingUp", "Looking up songwriters...")}
					</Text>
				</Flex>
			) : rows.length === 0 ? (
				<EmptyState
					icon={<PersonSearch24Regular />}
					title={t("songwriterFinder.noCredits", "No songwriters found")}
					description={
						<>
							{sourceSummary(results, t)}{" "}
							<Link
								href={getGuideUrl("songwriters")}
								target="_blank"
								rel="noopener noreferrer"
							>
								{t("songwriterFinder.manualGuide", "Find them by hand")}
							</Link>
						</>
					}
				/>
			) : (
				<>
					<Text size="1" color="gray">
						{sourceSummary(results, t)}{" "}
						{t(
							"songwriterFinder.checkNames",
							"Check the names before adding them.",
						)}
					</Text>
					<ul className={styles.rows}>
						{rows.map((row) => {
							const showLegal = !useCredited.has(row.id) && !!row.legal;
							const name = nameFor(row, showLegal);
							const checked = row.alreadyAdded || selected.has(row.id);
							return (
								<li
									key={row.id}
									className={styles.row}
									data-checked={checked || undefined}
								>
									<Checkbox
										id={`writer-${row.id}`}
										checked={checked}
										disabled={row.alreadyAdded}
										onCheckedChange={() =>
											setSelected((prev) => toggle(prev, row.id))
										}
									/>
									<div className={styles.rowText}>
										<Text
											as="label"
											htmlFor={`writer-${row.id}`}
											size="2"
											className={styles.rowName}
										>
											{name}
										</Text>
										<Text as="div" size="1" color="gray">
											{row.alreadyAdded ? (
												t("songwriterFinder.alreadyAdded", "Already added")
											) : row.legal ? (
												<>
													{showLegal
														? t(
																"songwriterFinder.creditedAs",
																"Credited as {name}.",
																{ name: row.credited },
															)
														: t(
																"songwriterFinder.legalName",
																"Real name: {name}.",
																{
																	name: row.legal,
																},
															)}{" "}
													<Link asChild size="1" className={styles.swap}>
														<button
															type="button"
															onClick={() =>
																setUseCredited((prev) => toggle(prev, row.id))
															}
														>
															{showLegal
																? t(
																		"songwriterFinder.useCredited",
																		"Use credited name",
																	)
																: t(
																		"songwriterFinder.useLegal",
																		"Use real name",
																	)}
														</button>
													</Link>
												</>
											) : results.length > 1 && row.sources.length === 1 ? (
												t(
													"songwriterFinder.oneSource",
													"Only one source lists this name.",
												)
											) : null}
										</Text>
									</div>
									<Flex gap="1" className={styles.sources}>
										{row.sources.map((source) => (
											<Badge key={source} color="gray" variant="outline">
												{SOURCE_LABEL[source]}
											</Badge>
										))}
									</Flex>
								</li>
							);
						})}
					</ul>
				</>
			)}
		</>
	);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content className={styles.dialogContent}>
				<Dialog.Title size="5" mb="1">
					{view === "token"
						? t(
								"metadataDialog.fetchSongwriters.setupTitle",
								"Genius access token",
							)
						: t("songwriterFinder.title", "Find songwriters")}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="4">
					{view === "token"
						? t(
								"songwriterFinder.tokenWhy",
								"With a token, the finder also checks Genius. MusicBrainz works without one.",
							)
						: t(
								"songwriterFinder.description",
								"Searches Genius and MusicBrainz for the song's writing credits.",
							)}
				</Dialog.Description>

				<div className={styles.body}>
					{view === "token" ? (
						<TokenSetup
							onDone={() => {
								setView("search");
								setSearch(undefined);
							}}
						/>
					) : view === "results" ? (
						resultsView
					) : (
						searchView
					)}
				</div>

				<div className={styles.footer}>
					{view === "token" ? (
						<Button
							variant="ghost"
							color="gray"
							onClick={() => setView("search")}
						>
							<ArrowLeft16Regular />
							{t("common.back", "Back")}
						</Button>
					) : !geniusApiKey ? (
						<Button
							variant="ghost"
							color="gray"
							onClick={() => setView("token")}
						>
							{t("songwriterFinder.addToken", "Add a Genius token")}
						</Button>
					) : (
						<span />
					)}
					<Flex gap="3">
						<Dialog.Close>
							<Button variant="soft" color="gray">
								{t("common.cancel", "Cancel")}
							</Button>
						</Dialog.Close>
						{view === "results" && (
							<Button disabled={chosenNames.length === 0} onClick={apply}>
								{t(
									"songwriterFinder.add",
									"{count, plural, =0 {Add songwriters} one {Add # songwriter} other {Add # songwriters}}",
									{ count: chosenNames.length },
								)}
							</Button>
						)}
					</Flex>
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
};
