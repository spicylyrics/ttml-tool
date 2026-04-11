import { Search16Regular, Search24Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Card,
	Checkbox,
	Dialog,
	Flex,
	ScrollArea,
	Spinner,
	Text,
	TextArea,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useSetAtom, useStore } from "jotai";

import { useImmerAtom } from "jotai-immer";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { uid } from "uid";
import { GeniusApi } from "../api/client";
import { getBetterGeniusCoverArt } from "../utils/image";
import type { GeniusSearchHit } from "../types";
import { geniusImportLyricsDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom, saveFileNameAtom, selectedLinesAtom, selectedWordsAtom } from "$/states/main.ts";

import type { LyricLine, LyricWord } from "$/types/ttml.ts";
import {
	geniusApiKeyAtom,
	importAddSpacesAtom,
	importSplitHyphensAtom,
} from "$/modules/settings/states/index.ts";









export const GeniusImportLyricsDialog = () => {
	const { t } = useTranslation();
	const store = useStore();

	const [isOpen, setIsOpen] = useAtom(geniusImportLyricsDialogAtom);
	const [, setLyricLines] = useImmerAtom(lyricLinesAtom);
	const setSaveFileName = useSetAtom(saveFileNameAtom);
	const [geniusApiKey, setGeniusApiKey] = useAtom(geniusApiKeyAtom);

	// Setup screen
	const [tempApiKey, setTempApiKey] = useState("");

	// Search
	const [query, setQuery] = useState("");
	const [results, setResults] = useState<GeniusSearchHit[]>([]);
	const [searching, setSearching] = useState(false);
	const [hasSearched, setHasSearched] = useState(false);

	// Lyrics preview
	const [selectedHit, setSelectedHit] = useState<GeniusSearchHit | null>(null);
	const [fetchingLyrics, setFetchingLyrics] = useState(false);
	const [editableLyrics, setEditableLyrics] = useState("");

	const [isEditing, setIsEditing] = useState(false);
	const inputRef = useRef<HTMLInputElement>(null);
	const [addSpaces, setAddSpaces] = useAtom(importAddSpacesAtom);
	const [splitHyphens, setSplitHyphens] = useAtom(importSplitHyphensAtom);




	useEffect(() => {
		if (isOpen) {
			setHasSearched(false);
			setResults([]);
			setSelectedHit(null);
			setEditableLyrics("");
			setIsEditing(false);
			setTimeout(() => {
				inputRef.current?.focus();
			}, 50);
		}
	}, [isOpen]);

	const handleSearch = useCallback(async () => {
		if (!query.trim()) return;
		setSearching(true);
		setHasSearched(true);
		setResults([]);
		setSelectedHit(null);
		setEditableLyrics("");
		setIsEditing(false);
		try {
			const data = await GeniusApi.search(query, geniusApiKey);
			setResults(data.response.hits);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			toast.error(t("metadataDialog.fetchSongwriters.searchError", "Search failed: {error}", { error: msg }));
		} finally {
			setSearching(false);
		}
	}, [query, geniusApiKey, t]);

	const handleSelectSong = useCallback(async (hit: GeniusSearchHit) => {
		setSelectedHit(hit);
		setFetchingLyrics(true);
		setEditableLyrics("");
		setIsEditing(false);

		// Set TTML metadata and file name immediately on song selection
		const title = hit.result.title;
		const artist = hit.result.primary_artist.name;
		const safeFileName = `${artist} - ${title}.ttml`
			.replace(/[/\\?%*:|"<>]/g, "-")
			.trim();
		setSaveFileName(safeFileName);
		setLyricLines((prev) => {
			const upsert = (key: string, value: string) => {
				const existing = prev.metadata.find((m) => m.key === key);
				if (existing) {
					existing.value = [value];
				} else {
					prev.metadata.push({ key, value: [value] });
				}
			};
			upsert("musicName", title);
			upsert("artists", artist);
			upsert("cover_art", hit.result.song_art_image_url);
		});

		try {
			const text = await GeniusApi.getLyrics(hit.result.url);
			setEditableLyrics(text);
		} catch (e) {
			const msg = e instanceof Error ? e.message : String(e);
			toast.error(t("metadataDialog.fetchSongwriters.fetchError", "Could not fetch lyrics: {error}", { error: msg }));
			setSelectedHit(null);
		} finally {
			setFetchingLyrics(false);
		}
	}, [setSaveFileName, setLyricLines, t]);

	const handleImport = useCallback(() => {
		const rawLines = editableLyrics.split("\n").map((l) => l.trim());

		const slopPatterns = [
			/^\[.*\]$/, // Section headers [Verse], [Chorus]
			/Embed$/, // Genius embed artifact
			/^\d+ Contributors?$/, // Contributor count
			/^You might also like$/, // Genius recommendation slop
			/^Translations?.*$/, // Translation slop
			/^\(Instrumental Intro\)$/i,
			/^\(Instrumental\)$/i,
		];

		const lines = rawLines.filter((l) => {
			if (!l) return false;
			return !slopPatterns.some((pattern) => pattern.test(l));
		});

		if (lines.length === 0) {
			toast.error(t("metadataDialog.fetchSongwriters.noLyricsError", "No lyrics to import."));
			return;
		}

		// Process all lines and split out background lyrics (text in parentheses)
		const processedLines: LyricLine[] = [];

		for (const lineText of lines) {
			// regex to find things like "Normal Text (Background Text)" or "(Background) Normal"
			// This regex matches groups of non-parentheses or groups inside parentheses
			const parts = lineText.split(/(\([^)]+\))/g).filter(p => p.trim());
			
			for (const part of parts) {
				const trimmed = part.trim();
				if (!trimmed) continue;

				const isBG = trimmed.startsWith("(") && trimmed.endsWith(")");
				let text = isBG ? trimmed.slice(1, -1).trim() : trimmed;
				
				// Final cleanup for text
				text = text.replace(/\s+/g, " ");
				if (!text) continue;

				const regex = addSpaces ? /(\s+)/ : /\s+/;
				let wordStrings = text.split(regex).filter(Boolean);

				if (splitHyphens) {
					wordStrings = wordStrings.flatMap((w) => w.split(/(?<=-)/g));
				}

				const words: LyricWord[] = wordStrings.map((word) => ({
					id: uid(),
					word,
					startTime: 0,
					endTime: 0,
					emptyBeat: 0,
					obscene: false,
					romanWord: "",
				}));






				processedLines.push({
					id: uid(),
					words,
					startTime: 0,
					endTime: 0,
					isBG,
					isDuet: false,
					ignoreSync: false,
					translatedLyric: "",
					romanLyric: "",
				});

			}
		}

		setLyricLines((prev) => {
			prev.lyricLines.push(...processedLines);
		});

		// Select the first new line and word
		if (processedLines.length > 0) {
			store.set(selectedLinesAtom, new Set([processedLines[0].id]));
			if (processedLines[0].words.length > 0) {
				store.set(selectedWordsAtom, new Set([processedLines[0].words[0].id]));
			}
		}

		toast.success(
			t("metadataDialog.fetchSongwriters.importSuccess", "Imported {count} lines from Genius.", {
				count: processedLines.length,
			}),
		);
		setIsOpen(false);
	}, [editableLyrics, setLyricLines, setIsOpen, t, addSpaces, splitHyphens, store]);





	// ── API key setup screen ────────────────────────────────────────────────────
	if (!geniusApiKey) {
		return (
			<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
				<Dialog.Content style={{ maxWidth: 500 }}>
					<Dialog.Title>{t("genius.setupTitle", "Genius API Key Setup")}</Dialog.Title>
					<Flex direction="column" gap="4">
						<Text size="2">
							{t("genius.setupDesc", "To import lyrics from Genius you need a CLIENT ACCESS TOKEN. You can generate one from the Genius developer portal.")}
						</Text>
						<TextField.Root
							placeholder={t("genius.keyPlaceholder", "Paste CLIENT ACCESS TOKEN here…")}
							value={tempApiKey}
							onChange={(e) => setTempApiKey(e.target.value)}
						/>
						<Flex justify="end" gap="2">
							<Dialog.Close>
								<Button variant="soft" color="gray">
									{t("common.cancel", "Cancel")}
								</Button>
							</Dialog.Close>
							<Button
								disabled={!tempApiKey.trim()}
								onClick={() => setGeniusApiKey(tempApiKey.trim())}
							>
								{t("common.save", "Save & Continue")}
							</Button>
						</Flex>
					</Flex>
				</Dialog.Content>
			</Dialog.Root>
		);
	}

	// ── Lyrics preview pane ────────────────────────────────────────────────────
	if (selectedHit) {
		return (
			<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
				<Dialog.Content style={{ maxWidth: 680, height: "82vh" }}>
					<Flex justify="between" align="center" mb="3">
						<Flex direction="column">
							<Dialog.Title mb="0">{t("genius.previewTitle", "Genius — Lyrics Preview")}</Dialog.Title>
							<Text size="1" color="gray" truncate style={{ maxWidth: 460 }}>
								{selectedHit.result.full_title}
							</Text>
						</Flex>
						<Button variant="soft" color="gray" onClick={() => { setSelectedHit(null); setEditableLyrics(""); }}>
							{t("genius.back", "← Back")}
						</Button>
					</Flex>

					{fetchingLyrics ? (
						<Flex align="center" justify="center" style={{ height: "60%" }}>
							<Spinner size="3" />
						</Flex>
					) : (
						<>
							<Flex justify="between" align="center" mb="2">
								<Text size="1" color="gray">
									{isEditing ? "Editing Raw Text" : t("genius.previewSubtitle", "Text in parentheses will be separated as background lyrics.")}
								</Text>
								<Button variant="ghost" size="1" onClick={() => setIsEditing(!isEditing)}>
									{isEditing ? "Back to Preview" : "Manual Edit"}
								</Button>
							</Flex>

							{isEditing ? (
								<TextArea
									value={editableLyrics}
									onChange={(e) => setEditableLyrics(e.target.value)}
									style={{ height: "calc(82vh - 200px)", resize: "none", fontSize: 13 }}
								/>
							) : (
								<Box
									style={{
										height: "calc(82vh - 200px)",
										padding: "16px",
										backgroundColor: "var(--gray-2)",
										border: "1px solid var(--gray-5)",
										borderRadius: "var(--radius-3)",
										overflow: "auto",
									}}
								>
									<pre
										style={{
											margin: 0,
											whiteSpace: "pre-wrap",
											fontFamily: "inherit",
											fontSize: "13px",
											lineHeight: "1.6",
											color: "var(--gray-12)",
										}}
				// biome-ignore lint/security/noDangerouslySetInnerHtml: Used for syntax highlighting in the preview
				dangerouslySetInnerHTML={{
					__html: editableLyrics
						.replace(/&/g, "&amp;")
						.replace(/</g, "&lt;")
						.replace(/>/g, "&gt;")
						.replace(/(\([^)]+\))/g, '<span style="opacity: 0.35; font-style: italic; font-weight: 300;">$1</span>')
				}}
									/>
								</Box>
							)}

							<Flex justify="between" align="center" mt="3">
								<Flex gap="2" align="center">
									<Text size="1" color="gray">
										{t("genius.linesCount", "{count} lines", { count: editableLyrics.split("\n").filter((l) => l.trim()).length })}
									</Text>
									<Flex gap="2" align="center" ml="3">
										<Text size="1" color="gray">{t("textImportDialog.addSpaces", "Add Spaces")}</Text>
										<Checkbox
											size="1"
											checked={addSpaces}
											onCheckedChange={(c: boolean) => setAddSpaces(c)}
										/>
									</Flex>
									<Flex gap="2" align="center" ml="3">
										<Text size="1" color="gray">{t("textImportDialog.splitHyphens", "Split Hyphens")}</Text>
										<Checkbox
											size="1"
											checked={splitHyphens}
											onCheckedChange={(c: boolean) => setSplitHyphens(c)}
										/>
									</Flex>


								</Flex>

								<Flex gap="2">
									<Dialog.Close>
										<Button variant="soft" color="gray">{t("common.cancel", "Cancel")}</Button>
									</Dialog.Close>
									<Button onClick={handleImport} disabled={!editableLyrics.trim()}>
										{t("genius.importButton", "Import Lyrics")}
									</Button>
								</Flex>
							</Flex>
						</>
					)}
				</Dialog.Content>
			</Dialog.Root>
		);
	}

	// ── Search pane ────────────────────────────────────────────────────────────
	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 620, height: "70vh" }}>
				<Dialog.Title>{t("genius.importTitle", "Import Lyrics from Genius")}</Dialog.Title>

				<Flex gap="3" mb="4">
					<TextField.Root
						ref={inputRef}
						style={{ flex: 1 }}
						placeholder={t("genius.searchPlaceholder", "Artist – Song title…")}
						value={query}
						onChange={(e) => setQuery(e.target.value)}
						onKeyDown={(e) => e.key === "Enter" && handleSearch()}
					>
						<TextField.Slot>
							<Search16Regular />
						</TextField.Slot>
					</TextField.Root>
					<Button onClick={handleSearch} disabled={searching}>
						{searching ? <Spinner /> : t("common.search", "Search")}
					</Button>
				</Flex>

				<ScrollArea type="auto" scrollbars="vertical" style={{ height: "calc(70vh - 160px)" }}>
					<Flex direction="column" gap="2">
						{searching && (
							<Flex align="center" justify="center" p="6">
								<Spinner size="3" />
							</Flex>
						)}

						{!searching && results.map((hit) => (
							<Card
								key={hit.result.id}
								onClick={() => handleSelectSong(hit)}
								style={{ cursor: "pointer" }}
							>
								<Flex align="center" gap="3">
									<img
										src={getBetterGeniusCoverArt(
											hit.result.song_art_image_url ||
												hit.result.song_art_image_thumbnail_url,
											100,
										)}
										alt={hit.result.title}
										style={{ width: 48, height: 48, borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
										referrerPolicy="no-referrer"
									/>
									<Flex direction="column" gap="1" style={{ flex: 1, minWidth: 0 }}>
										<Text size="2" weight="bold" truncate>{hit.result.title}</Text>
										<Text size="1" color="gray" truncate>{hit.result.primary_artist.name}</Text>
									</Flex>
								</Flex>
							</Card>
						))}

						{!searching && hasSearched && results.length === 0 && (
							<Flex direction="column" align="center" justify="center" gap="2" p="6" style={{ color: "var(--gray-9)" }}>
								<Search24Regular style={{ width: 40, height: 40 }} />
								<Text>{t("genius.notFound", "No results found. Try different keywords.")}</Text>
							</Flex>
						)}

						{!hasSearched && !searching && (
							<Flex direction="column" align="center" justify="center" gap="2" p="6" style={{ color: "var(--gray-9)" }}>
								<Search24Regular style={{ width: 40, height: 40 }} />
								<Text>{t("genius.noResult", "Enter a song name or artist to start.")}</Text>
							</Flex>
						)}
					</Flex>
				</ScrollArea>

				<Flex justify="between" align="center" mt="3">
					<Button variant="ghost" size="1" color="gray" onClick={() => setGeniusApiKey("")}>
						{t("genius.changeKey", "Change API Key")}
					</Button>
					<Dialog.Close>
						<Button variant="soft" color="gray">{t("common.close", "Close")}</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
