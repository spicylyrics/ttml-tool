import { Flex } from "@radix-ui/themes";
import { useAtomValue } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	OnlineResults,
	OnlineSearchBar,
} from "$/modules/lyrics-import/components/OnlineSearchPanel";
import {
	type ImportTrack,
	searchOnlineLyrics,
} from "$/modules/lyrics-import/logic/online-sources";
import { geniusApiKeyAtom } from "$/modules/settings/states/index.ts";
import { error as logError } from "$/utils/logging";

/** The import screen's Genius search, picking a song for the list instead of its lyrics. */
export const GeniusSongSearch = ({
	onPick,
}: {
	onPick: (track: { song: string; artist: string; geniusId?: number }) => void;
}) => {
	const { t } = useTranslation();
	const geniusApiKey = useAtomValue(geniusApiKeyAtom);
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<ImportTrack[]>([]);
	const [searching, setSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);

	const search = async () => {
		if (!query.trim() || !geniusApiKey) return;
		setSearching(true);
		try {
			setResults(await searchOnlineLyrics("genius", query, geniusApiKey));
		} catch (e) {
			logError("Genius search for the song list failed", e);
			toast.error(
				t("projectsHub.songs.searchFailed", "Couldn't search Genius."),
			);
			setResults([]);
		} finally {
			setSearching(false);
			setHasSearched(true);
		}
	};

	return (
		<Flex direction="column" gap="2">
			<OnlineSearchBar
				source="genius"
				query={query}
				onQueryChange={setQuery}
				onSearch={() => void search()}
				searching={searching}
			/>
			{geniusApiKey && (
				<OnlineResults
					results={results}
					searching={searching}
					hasSearched={hasSearched}
					audioDuration={0}
					loadingId={null}
					onPick={(track) =>
						onPick({
							song: track.name,
							artist: track.artist,
							geniusId: typeof track.id === "number" ? track.id : undefined,
						})
					}
				/>
			)}
		</Flex>
	);
};
