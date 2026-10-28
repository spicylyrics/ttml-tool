import { ArrowClockwise16Regular } from "@fluentui/react-icons";
import { Button, Flex, Spinner, Text } from "@radix-ui/themes";
import { useAtomValue, useSetAtom } from "jotai";
import { useCallback, useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { loadedAudioAtom } from "$/modules/audio/states";
import { GeniusApi } from "$/modules/genius/api/client";
import {
	OnlineResults,
	OnlineSearchBar,
} from "$/modules/lyrics-import/components/OnlineSearchPanel";
import {
	type ImportTrack,
	searchOnlineLyrics,
} from "$/modules/lyrics-import/logic/online-sources";
import { getAudioSearchQuery } from "$/modules/project/logic/song-metadata";
import { loadedAudioSongAtom } from "$/modules/project/song-metadata-state";
import { geniusApiKeyAtom } from "$/modules/settings/states/index.ts";
import type { ReferenceGeniusSong } from "./project-memory";
import styles from "./ReferenceSidebar.module.css";
import {
	referenceSidebarGeniusSongAtom,
	referenceSidebarStateAtom,
} from "./states";

// Fetched lyrics for this session, so switching tabs or projects doesn't refetch.
const lyricsCache = new Map<number, string>();

type LyricsState =
	| { status: "loading" }
	| { status: "ready"; text: string }
	| { status: "error"; message: string };

const useGeniusLyrics = (song: ReferenceGeniusSong | null) => {
	const [state, setState] = useState<LyricsState>({ status: "loading" });
	const [attempt, setAttempt] = useState(0);

	useEffect(() => {
		if (!song) return;
		// Re-run when the user asks to retry.
		void attempt;
		const cached = lyricsCache.get(song.id);
		if (cached !== undefined) {
			setState({ status: "ready", text: cached });
			return;
		}
		let cancelled = false;
		setState({ status: "loading" });
		GeniusApi.getLyrics(song.id).then(
			(text) => {
				lyricsCache.set(song.id, text);
				if (!cancelled) setState({ status: "ready", text });
			},
			(error: unknown) => {
				if (!cancelled)
					setState({
						status: "error",
						message: error instanceof Error ? error.message : String(error),
					});
			},
		);
		return () => {
			cancelled = true;
		};
	}, [song, attempt]);

	return { state, retry: () => setAttempt((value) => value + 1) };
};

const GeniusSearch = ({
	onDone,
	onCancel,
}: {
	onDone: () => void;
	/** Set when a song is already picked, to go back to its lyrics. */
	onCancel?: () => void;
}) => {
	const { t } = useTranslation();
	const geniusApiKey = useAtomValue(geniusApiKeyAtom);
	const audio = useAtomValue(loadedAudioAtom);
	const audioSong = useAtomValue(loadedAudioSongAtom);
	const setSidebarState = useSetAtom(referenceSidebarStateAtom);
	const [query, setQuery] = useState(() =>
		getAudioSearchQuery(
			audioSong?.audio === audio ? audioSong.song : {},
			audio instanceof File ? audio.name : "",
		),
	);
	const [results, setResults] = useState<ImportTrack[]>([]);
	const [searching, setSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);
	const [error, setError] = useState<string | null>(null);

	const search = useCallback(async () => {
		if (!query.trim()) return;
		setSearching(true);
		setError(null);
		try {
			setResults(await searchOnlineLyrics("genius", query, geniusApiKey));
		} catch (e) {
			setResults([]);
			setError(e instanceof Error ? e.message : String(e));
		} finally {
			setSearching(false);
			setHasSearched(true);
		}
	}, [geniusApiKey, query]);

	const pick = (track: ImportTrack) => {
		if (typeof track.id !== "number") return;
		setSidebarState({
			genius: { id: track.id, name: track.name, artist: track.artist },
		});
		onDone();
	};

	return (
		<Flex direction="column" gap="2" className={styles.fill}>
			{onCancel && (
				<Flex justify="end" flexShrink="0">
					<Button size="1" variant="soft" color="gray" onClick={onCancel}>
						{t("referenceSidebar.genius.backToLyrics", "Back to lyrics")}
					</Button>
				</Flex>
			)}
			<OnlineSearchBar
				source="genius"
				query={query}
				onQueryChange={setQuery}
				onSearch={search}
				searching={searching}
				autoFocus={false}
			/>
			{error && (
				<Text size="1" color="red" role="alert">
					{t("referenceSidebar.genius.searchFailed", "Search failed: {error}", {
						error,
					})}
				</Text>
			)}
			{geniusApiKey && (
				<OnlineResults
					results={results}
					searching={searching}
					hasSearched={hasSearched}
					audioDuration={0}
					loadingId={null}
					onPick={pick}
				/>
			)}
		</Flex>
	);
};

const GeniusLyrics = ({
	song,
	onChange,
}: {
	song: ReferenceGeniusSong;
	onChange: () => void;
}) => {
	const { t } = useTranslation();
	const { state, retry } = useGeniusLyrics(song);

	return (
		<Flex direction="column" gap="2" className={styles.fill}>
			<Flex align="center" justify="between" gap="2" flexShrink="0">
				<Flex direction="column" minWidth="0">
					<Text size="2" weight="medium" truncate>
						{song.name}
					</Text>
					<Text size="1" color="gray" truncate>
						{song.artist}
					</Text>
				</Flex>
				<Button size="1" variant="soft" color="gray" onClick={onChange}>
					{t("referenceSidebar.genius.changeSong", "Change song")}
				</Button>
			</Flex>
			{state.status === "loading" && (
				<Flex align="center" justify="center" flexGrow="1">
					<Spinner size="3" />
				</Flex>
			)}
			{state.status === "error" && (
				<Flex direction="column" align="start" gap="2" role="alert">
					<Text size="2" color="red">
						{t(
							"referenceSidebar.genius.loadFailed",
							"Could not load the lyrics: {error}",
							{ error: state.message },
						)}
					</Text>
					<Button size="1" variant="soft" onClick={retry}>
						<ArrowClockwise16Regular />
						{t("referenceSidebar.genius.retry", "Try again")}
					</Button>
				</Flex>
			)}
			{state.status === "ready" &&
				(state.text.trim() ? (
					<section
						className={styles.lyrics}
						aria-label={t(
							"referenceSidebar.genius.lyricsLabel",
							"Genius lyrics for {title}",
							{ title: song.name },
						)}
						// Focusable so keyboard users can scroll it.
						tabIndex={0}
					>
						{state.text}
					</section>
				) : (
					<Text size="2" color="gray">
						{t(
							"onlineImport.noLyricsLabel",
							"No lyrics available for this track.",
						)}
					</Text>
				))}
		</Flex>
	);
};

/** Genius lyrics, read-only, for checking spelling and lines while editing. */
export const GeniusReferenceTab = () => {
	const song = useAtomValue(referenceSidebarGeniusSongAtom);
	const [searching, setSearching] = useState(!song);

	useEffect(() => {
		// A project switch can bring a different saved song (or none).
		setSearching(!song);
	}, [song]);

	if (!song || searching)
		return (
			<GeniusSearch
				onDone={() => setSearching(false)}
				onCancel={song ? () => setSearching(false) : undefined}
			/>
		);
	return <GeniusLyrics song={song} onChange={() => setSearching(true)} />;
};

export default GeniusReferenceTab;
