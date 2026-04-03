import { Search16Regular, Search24Regular } from "@fluentui/react-icons";
import {
	Button,
	Card,
	Checkbox,
	Dialog,
	Flex,
	ScrollArea,
	Spinner,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useImmerAtom } from "jotai-immer";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { geniusSearchDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import { geniusApiKeyAtom } from "$/modules/settings/states/index.ts";
import { GeniusApi } from "../api/client";
import type { GeniusSearchHit } from "../types";
import styles from "./GeniusSearchDialog.module.css";

export const GeniusSearchDialog = () => {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(geniusSearchDialogAtom);
	const [lyricLines, setLyricLines] = useImmerAtom(lyricLinesAtom);

	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GeniusSearchHit[]>([]);
	const [loading, setLoading] = useState(false);
	const [isFetchingDetails, setIsFetchingDetails] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [findRealNames, setFindRealNames] = useState(false);
	const [processingMessage, setProcessingMessage] = useState("");

	const [geniusApiKey, setGeniusApiKey] = useAtom(geniusApiKeyAtom);
	const [tempApiKey, setTempApiKey] = useState("");

	const inputRef = useRef<HTMLInputElement>(null);

	// Pre-fill query from metadata when opening
	useEffect(() => {
		if (isOpen) {
			const musicName = lyricLines.metadata.find((m) => m.key === "musicName")
				?.value[0];
			const primaryArtist = lyricLines.metadata.find((m) => m.key === "artists")
				?.value[0];

			const initialQuery = [primaryArtist, musicName].filter(Boolean).join(" ");
			setQuery(initialQuery);
			setHasSearched(false);
			setResults([]);

			// Auto-focus after a short delay to ensure the dialog is open
			setTimeout(() => {
				inputRef.current?.focus();
				inputRef.current?.select();
			}, 50);
		}
	}, [isOpen, lyricLines.metadata]);

	const handleSearch = useCallback(async () => {
		if (!query.trim()) return;
		setLoading(true);
		setHasSearched(true);
		setResults([]);

		try {
			const data = await GeniusApi.search(query, geniusApiKey);
			const hits = data.response.hits;
			setResults(hits);
			if (hits.length > 0) {
				toast.success(
					t("common.resultsFound", "Found {{count}} results", {
						count: hits.length,
					}),
				);
			}
		} catch (e: unknown) {
			console.error("Genius Search Error", e);
			const errorMsg = e instanceof Error ? e.message : String(e);
			toast.error(
				`${t("metadataDialog.fetchSongwriters.error", "Failed to fetch songwriters")}: ${errorMsg}`,
			);
		} finally {
			setLoading(false);
		}
	}, [query, t, geniusApiKey]);

	const handleSelectSong = useCallback(
		async (hit: GeniusSearchHit) => {
			setIsFetchingDetails(true);
			try {
				const songDetailsRes = await GeniusApi.getSongById(hit.result.id, geniusApiKey);
				let songwriters = songDetailsRes.response.song.writer_artists.map(
					(a) => a.name,
				);

				if (songwriters.length === 0) {
					toast.info(
						t(
							"metadataDialog.fetchSongwriters.noSongwriters",
							"No songwriting credits recorded for this song",
						),
					);
					setIsFetchingDetails(false);
					return;
				}

				if (findRealNames) {
					const realNames: string[] = [];
					const artists = songDetailsRes.response.song.writer_artists;
					for (let i = 0; i < artists.length; i++) {
						const artist = artists[i];
						setProcessingMessage(
							t(
								"metadataDialog.fetchSongwriters.findingRealName",
								"Finding real name for {{name}} ({{current}}/{{total}})...",
								{
									name: artist.name,
									current: i + 1,
									total: artists.length,
								},
							),
						);
						try {
							const detailRes = await GeniusApi.getArtistById(artist.id, geniusApiKey);
							const artistDetail = detailRes.response.artist;
							const altNames = artistDetail.alternate_names || [];
							const description = artistDetail.description.plain || "";

							let realName = artist.name;

							// 1. Try to extract from description using regex
							const bornMatch = description.match(
								/born\s+([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+){1,4})/,
							);
							const realNameMatch = description.match(
								/real\s+name\s+(?:is\s+)?([A-Z][a-zA-Z.]+(?:\s[A-Z][a-zA-Z.]+){1,4})/i,
							);

							if (bornMatch) {
								realName = bornMatch[1];
							} else if (realNameMatch) {
								realName = realNameMatch[1];
							} else {
								// 2. Fallback to alternate_names with strict filtering
								const forbiddenPrefixes = [
									"King ",
									"The ",
									"Mr. ",
									"aka ",
									"alias ",
									"DJ ",
								];
								const potentialNames = altNames.filter((name) => {
									const isNotStageName =
										!name.toLowerCase().includes(artist.name.toLowerCase()) &&
										!artist.name.toLowerCase().includes(name.toLowerCase());
									const hasGoodWordCount =
										name.split(" ").length >= 2 && name.split(" ").length <= 4;
									const noForbiddenPrefix = !forbiddenPrefixes.some((p) =>
										name.startsWith(p),
									);
									const isCapitalized = name
										.split(" ")
										.every((word) => /^[A-Z]/.test(word));
									const noUrls =
										!name.includes("http") && !name.includes("www.");

									return (
										isNotStageName &&
										hasGoodWordCount &&
										noForbiddenPrefix &&
										isCapitalized &&
										noUrls
									);
								});

								if (potentialNames.length > 0) {
									// Prioritize the shortest multi-word name as it's often the cleanest "Real Name"
									realName = potentialNames.sort(
										(a, b) => a.length - b.length,
									)[0];
								}
							}

							realNames.push(realName);
						} catch (e) {
							console.error(`Failed to fetch real name for ${artist.name}`, e);
							realNames.push(artist.name);
						}
					}
					songwriters = realNames;
					setProcessingMessage("");
				}

				setLyricLines((prev) => {
					const songwriterEntry = prev.metadata.find(
						(m) => m.key === "songwriter",
					);
					if (songwriterEntry) {
						const existing = new Set(songwriterEntry.value);
						for (const writer of songwriters) {
							if (!existing.has(writer)) {
								if (
									songwriterEntry.value.length === 1 &&
									songwriterEntry.value[0] === ""
								) {
									songwriterEntry.value[0] = writer;
								} else {
									songwriterEntry.value.push(writer);
								}
								existing.add(writer);
							}
						}
					} else {
						prev.metadata.push({
							key: "songwriter",
							value: songwriters,
						});
					}
				});

				toast.success(
					t(
						"metadataDialog.fetchSongwriters.success",
						"Songwriters successfully fetched from Genius",
					),
				);
				setIsOpen(false);
			} catch (error) {
				console.error(error);
				toast.error(
					t(
						"metadataDialog.fetchSongwriters.error",
						"Failed to fetch songwriters",
					),
				);
			} finally {
				setIsFetchingDetails(false);
			}
		},
		[setLyricLines, setIsOpen, t, findRealNames, geniusApiKey],
	);

	const onKeyDown = (e: React.KeyboardEvent) => {
		if (e.key === "Enter") {
			handleSearch();
		}
	};

	if (!geniusApiKey) {
		return (
			<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
				<Dialog.Content className={styles.dialogContent}>
					<Dialog.Title>
						{t("metadataDialog.fetchSongwriters.setupTitle", "Genius API Key Setup")}
					</Dialog.Title>
					<Flex direction="column" gap="4">
						<Text>
							{t("metadataDialog.fetchSongwriters.setupDesc", 'To use this feature, please configure your Genius API Key (specifically, you need the "CLIENT ACCESS TOKEN"). You can generate one from the ')}
							<a href="https://genius.com/api-clients" target="_blank" rel="noopener noreferrer">
								Genius
							</a>
							{t("metadataDialog.fetchSongwriters.setupDescEnd", " developer portal.")}
						</Text>
						<TextField.Root
							placeholder={t("metadataDialog.fetchSongwriters.keyPlaceholder", "Enter CLIENT ACCESS TOKEN")}
							value={tempApiKey}
							onChange={(e) => setTempApiKey(e.target.value)}
						/>
						<Flex justify="end" gap="2" mt="2">
							<Dialog.Close>
								<Button variant="soft" color="gray" onClick={() => setIsOpen(false)}>
									{t("common.cancel", "Cancel")}
								</Button>
							</Dialog.Close>
							<Button disabled={!tempApiKey.trim()} onClick={() => setGeniusApiKey(tempApiKey.trim())}>
								{t("common.save", "Save")}
							</Button>
						</Flex>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
		);
	}

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content className={styles.dialogContent}>
				<Dialog.Title>
					{t(
						"metadataDialog.fetchSongwriters.button",
						"Fetch Songwriters from Genius",
					)}
				</Dialog.Title>

				<Flex gap="3" mb="4">
					<TextField.Root
						ref={inputRef}
						className={styles.searchBar}
						placeholder={t("lrclib.placeholder", "Title Artist...")}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={onKeyDown}
					>
						<TextField.Slot>
							<Search16Regular />
						</TextField.Slot>
					</TextField.Root>
					<Button
						onClick={handleSearch}
						disabled={loading || isFetchingDetails}
					>
						{loading ? <Spinner /> : t("common.search", "Search")}
					</Button>
				</Flex>

				<ScrollArea
					type="auto"
					scrollbars="vertical"
					className={styles.scrollArea}
				>
					<Flex direction="column" gap="2" className={styles.resultList}>
						{loading ? (
							<Flex align="center" justify="center" p="4">
								<Spinner size="3" />
							</Flex>
						) : (
							results.map((hit) => (
								<Card
									key={hit.result.id}
									className={styles.resultCard}
									onClick={() => !isFetchingDetails && handleSelectSong(hit)}
								>
									<Flex align="center" gap="4">
										<img
											src={hit.result.song_art_image_thumbnail_url}
											alt={hit.result.title}
											className={styles.thumbnail}
										/>
										<Flex
											direction="column"
											gap="1"
											style={{ flex: 1, minWidth: 0 }}
										>
											<Text size="3" weight="bold" truncate>
												{hit.result.title}
											</Text>
											<Text size="1" color="gray" truncate>
												{hit.result.primary_artist.name}
											</Text>
										</Flex>
										{isFetchingDetails && <Spinner />}
									</Flex>
								</Card>
							))
						)}

						{!loading && hasSearched && results.length === 0 && (
							<Flex className={styles.emptyState}>
								<Search24Regular className={styles.emptyStateIcon} />
								<Text>
									{t(
										"lrclib.notFound",
										"No results found, please try different keywords",
									)}
								</Text>
							</Flex>
						)}

						{!hasSearched && (
							<Flex className={styles.emptyState}>
								<Search24Regular className={styles.emptyStateIcon} />
								<Text>
									{t("lrclib.noResult", "Enter keywords to start searching")}
								</Text>
							</Flex>
						)}
					</Flex>
				</ScrollArea>

				<Flex justify="between" align="center" mt="4">
					<Flex align="center" gap="2">
						<Text as="label" size="2">
							<Flex gap="2" align="center">
								<Checkbox
									checked={findRealNames}
									onCheckedChange={(c) => setFindRealNames(!!c)}
								/>
								{t(
									"metadataDialog.fetchSongwriters.tryFindRealNames",
									"Try to find real names (Legal Names)",
								)}
							</Flex>
						</Text>
						{processingMessage && (
							<Flex align="center" gap="2">
								<Spinner size="1" />
								<Text
									size="1"
									color="gray"
									truncate
									style={{ maxWidth: "250px" }}
								>
									{processingMessage}
								</Text>
							</Flex>
						)}
					</Flex>
					<Dialog.Close>
						<Button variant="soft" color="gray" disabled={isFetchingDetails}>
							{t("common.close", "Close")}
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
