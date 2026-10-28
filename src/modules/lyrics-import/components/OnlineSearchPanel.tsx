import { DismissRegular, Search16Regular } from "@fluentui/react-icons";
import {
	Badge,
	Button,
	Flex,
	IconButton,
	Spinner,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getBetterGeniusCoverArt } from "$/modules/genius/utils/image";
import { geniusApiKeyAtom } from "$/modules/settings/states/index.ts";
import { getGeniusKeyGuideUrl } from "$/utils/genius-guide";
import type { ImportTrack, OnlineImportSource } from "../logic/online-sources";
import { formatTrackDuration, matchesAudioDuration } from "../track-duration";
import styles from "./OnlineSearchPanel.module.css";

/** Search row for an online source, or the Genius token form when there is no token yet. */
export function OnlineSearchBar({
	source,
	query,
	onQueryChange,
	onSearch,
	searching,
	autoFocus = true,
}: {
	source: OnlineImportSource;
	query: string;
	onQueryChange: (query: string) => void;
	onSearch: () => void;
	searching: boolean;
	/** Off where the bar sits beside the editor, so it doesn't take focus from it. */
	autoFocus?: boolean;
}) {
	const { t } = useTranslation();
	const [geniusApiKey, setGeniusApiKey] = useAtom(geniusApiKeyAtom);
	const [tempApiKey, setTempApiKey] = useState("");

	if (source === "genius" && !geniusApiKey) {
		return (
			<Flex direction="column" gap="2" className={styles.tokenForm}>
				<Text size="2" weight="medium">
					{t("genius.setupTitle", "Genius access token")}
				</Text>
				<Text size="2" color="gray">
					{t(
						"genius.setupDesc",
						"To import from Genius you need a Genius access token (Genius calls it the Client Access Token). You can create one in the Genius developer portal.",
					)}{" "}
					<a href={getGeniusKeyGuideUrl()} target="_blank" rel="noreferrer">
						{t("genius.howToGetKey", "How to get a Genius access token")}
					</a>
				</Text>
				<Flex gap="2">
					<TextField.Root
						style={{ flex: 1 }}
						value={tempApiKey}
						onChange={(event) => setTempApiKey(event.target.value)}
						onKeyDown={(event) => {
							if (event.key === "Enter" && tempApiKey.trim())
								setGeniusApiKey(tempApiKey.trim());
						}}
						placeholder={t(
							"genius.keyPlaceholder",
							"Paste your Genius access token...",
						)}
						aria-label={t("genius.setupTitle", "Genius access token")}
					/>
					<Button
						disabled={!tempApiKey.trim()}
						onClick={() => setGeniusApiKey(tempApiKey.trim())}
					>
						{t("common.save", "Save")}
					</Button>
				</Flex>
			</Flex>
		);
	}

	return (
		<Flex gap="2" align="center">
			<TextField.Root
				autoFocus={autoFocus}
				style={{ flex: 1 }}
				placeholder={t("lrclib.placeholder", "Song title and artist...")}
				aria-label={t("common.search", "Search")}
				value={query}
				onChange={(event) => onQueryChange(event.target.value)}
				onKeyDown={(event) => event.key === "Enter" && onSearch()}
			>
				<TextField.Slot>
					<Search16Regular />
				</TextField.Slot>
			</TextField.Root>
			<Button onClick={onSearch} disabled={searching || !query.trim()}>
				{searching ? <Spinner /> : t("common.search", "Search")}
			</Button>
			{source === "genius" && (
				<Button
					variant="ghost"
					color="gray"
					onClick={() => setGeniusApiKey("")}
				>
					{t("genius.changeKey", "Change access token")}
				</Button>
			)}
		</Flex>
	);
}

export function OnlineResults({
	results,
	searching,
	hasSearched,
	audioDuration,
	loadingId,
	onPick,
}: {
	results: ImportTrack[];
	searching: boolean;
	hasSearched: boolean;
	audioDuration: number;
	loadingId: ImportTrack["id"] | null;
	onPick: (track: ImportTrack) => void;
}) {
	const { t } = useTranslation();
	if (searching)
		return (
			<Flex align="center" justify="center" className={styles.empty}>
				<Spinner size="3" />
			</Flex>
		);
	if (results.length === 0)
		return (
			<Flex align="center" justify="center" className={styles.empty}>
				<Text size="2" color="gray">
					{hasSearched
						? t("genius.notFound", "No results found. Try different keywords.")
						: t("genius.noResult", "Enter a song name or artist to start.")}
				</Text>
			</Flex>
		);
	return (
		<div className={styles.results}>
			{results.map((track) => (
				<button
					type="button"
					key={`${track.source}-${track.id}`}
					className={styles.result}
					onClick={() => onPick(track)}
					disabled={loadingId !== null}
				>
					{track.cover ? (
						<img
							src={getBetterGeniusCoverArt(track.cover, 100)}
							alt=""
							className={styles.cover}
							referrerPolicy="no-referrer"
						/>
					) : (
						// LRCLIB has no artwork, so only keep the slot where covers are expected.
						track.source === "genius" && <span className={styles.cover} />
					)}
					<Flex direction="column" gap="1" minWidth="0" flexGrow="1">
						<Text size="2" weight="medium" truncate>
							{track.name}
						</Text>
						<Text size="1" color="gray" truncate>
							{track.artist}
							{track.album ? ` · ${track.album}` : ""}
						</Text>
					</Flex>
					{track.duration !== undefined && Number.isFinite(track.duration) && (
						<Flex align="center" gap="2" flexShrink="0">
							{matchesAudioDuration(track.duration, audioDuration) && (
								<Badge color="green">
									{t("lrclib.matchesAudio", "Matches your audio")}
								</Badge>
							)}
							<Text size="1" color="gray">
								{formatTrackDuration(track.duration)}
							</Text>
						</Flex>
					)}
					{loadingId === track.id && <Spinner />}
				</button>
			))}
		</div>
	);
}

/** Shows which song's details will be filled in on import. */
export function PickedTrack({
	track,
	onDrop,
}: {
	track: ImportTrack;
	onDrop: () => void;
}) {
	const { t } = useTranslation();
	return (
		<Flex align="center" gap="2" className={styles.picked}>
			<Text size="1" color="gray" truncate>
				{t("importLyrics.usingTrack", "Details from {title} by {artist}", {
					title: track.name,
					artist: track.artist,
				})}
			</Text>
			<IconButton
				size="1"
				variant="ghost"
				color="gray"
				aria-label={t("importLyrics.dropTrack", "Don't use these details")}
				title={t("importLyrics.dropTrack", "Don't use these details")}
				onClick={onDrop}
			>
				<DismissRegular />
			</IconButton>
		</Flex>
	);
}
