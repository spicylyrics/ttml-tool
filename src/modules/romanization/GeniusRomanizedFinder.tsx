import { ErrorCircle16Regular, Search16Regular } from "@fluentui/react-icons";
import { Button, Flex, Spinner, Text, TextField } from "@radix-ui/themes";
import { useAtom, useStore } from "jotai";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { geniusApiKeyAtom } from "$/modules/settings/states/index.ts";
import { lyricLinesAtom } from "$/states/main";
import { getGeniusKeyGuideUrl } from "$/utils/genius-guide";
import {
	fetchRomanizedLyrics,
	findRomanizedCandidates,
	type RomanizedCandidate,
} from "./genius-romanized";

const firstMetadata = (
	metadata: { key: string; value: string[] }[],
	key: string,
) => metadata.find((entry) => entry.key === key)?.value[0]?.trim() ?? "";

/**
 * Finds the song's romanized page on Genius and hands its lyrics to the paste
 * box. It never applies anything itself.
 */
export function GeniusRomanizedFinder({
	onLyrics,
}: {
	onLyrics: (lyrics: string) => void;
}) {
	const { t } = useTranslation();
	const store = useStore();
	const [geniusApiKey, setGeniusApiKey] = useAtom(geniusApiKeyAtom);
	const [tempApiKey, setTempApiKey] = useState("");
	const [title, setTitle] = useState(() =>
		firstMetadata(store.get(lyricLinesAtom).metadata, "musicName"),
	);
	const [candidates, setCandidates] = useState<RomanizedCandidate[] | null>(
		null,
	);
	const [searching, setSearching] = useState(false);
	const [loadingId, setLoadingId] = useState<number | null>(null);
	const [problem, setProblem] = useState("");
	const [needsToken, setNeedsToken] = useState(false);

	// Only ask for a token once someone tries to search, so the dialog still
	// reads as a paste box first.
	if (needsToken && !geniusApiKey) {
		return (
			<Flex direction="column" gap="2">
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

	const search = async () => {
		if (!title.trim() || searching) return;
		if (!geniusApiKey) {
			setNeedsToken(true);
			return;
		}
		setSearching(true);
		setProblem("");
		try {
			const artist = firstMetadata(
				store.get(lyricLinesAtom).metadata,
				"artists",
			);
			setCandidates(
				await findRomanizedCandidates(
					{ title: title.trim(), artist },
					geniusApiKey,
				),
			);
		} catch (error) {
			setCandidates(null);
			setProblem(
				t(
					"romanizationTools.genius.failed",
					"Genius did not answer: {message}",
					{
						message: error instanceof Error ? error.message : String(error),
					},
				),
			);
		} finally {
			setSearching(false);
		}
	};

	const pick = async (candidate: RomanizedCandidate) => {
		setLoadingId(candidate.id);
		setProblem("");
		try {
			onLyrics(await fetchRomanizedLyrics(candidate.id));
			setCandidates(null);
		} catch (error) {
			setProblem(
				t(
					"romanizationTools.genius.failed",
					"Genius did not answer: {message}",
					{
						message: error instanceof Error ? error.message : String(error),
					},
				),
			);
		} finally {
			setLoadingId(null);
		}
	};

	return (
		<Flex direction="column" gap="2">
			<Flex gap="2" align="center">
				<TextField.Root
					style={{ flex: 1 }}
					value={title}
					onChange={(event) => setTitle(event.target.value)}
					onKeyDown={(event) => event.key === "Enter" && search()}
					placeholder={t("romanizationTools.genius.titleLabel", "Song title")}
					aria-label={t("romanizationTools.genius.titleLabel", "Song title")}
				>
					<TextField.Slot>
						<Search16Regular />
					</TextField.Slot>
				</TextField.Root>
				<Button
					variant="soft"
					onClick={search}
					disabled={searching || !title.trim()}
				>
					{searching ? (
						<Spinner />
					) : (
						t("romanizationTools.genius.find", "Find on Genius")
					)}
				</Button>
			</Flex>
			{candidates?.length === 0 && (
				<Text size="2" color="gray">
					{t(
						"romanizationTools.genius.none",
						"No romanized page found. Try the title as Genius writes it.",
					)}
				</Text>
			)}
			{candidates && candidates.length > 0 && (
				<Flex direction="column" gap="1">
					{candidates.map((candidate) => (
						<Button
							key={candidate.id}
							variant="ghost"
							color="gray"
							style={{ justifyContent: "flex-start", height: "auto" }}
							onClick={() => pick(candidate)}
							disabled={loadingId !== null}
						>
							<Flex direction="column" align="start" minWidth="0" py="1">
								<Text size="2" weight="medium" truncate>
									{candidate.title}
								</Text>
								<Text size="1" color="gray" truncate>
									{candidate.artist}
								</Text>
							</Flex>
							{loadingId === candidate.id && <Spinner />}
						</Button>
					))}
				</Flex>
			)}
			{problem && (
				<Flex gap="2" align="start" role="alert">
					<Text color="red" asChild>
						<ErrorCircle16Regular aria-hidden />
					</Text>
					<Text size="2" color="red">
						{problem}
					</Text>
				</Flex>
			)}
		</Flex>
	);
}
