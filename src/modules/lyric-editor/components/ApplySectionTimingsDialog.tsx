import { Button, Dialog, Flex, Text } from "@radix-ui/themes";
import { useAtom, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { ChoiceList } from "$/components/ChoiceList";
import { OptionPicker } from "$/components/OptionPicker";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import { sectionTimingsAnchorAtom } from "$/modules/settings/states/index.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";
import { applyTimingsSectionIdAtom } from "../states/sections.ts";
import {
	type ApplyTimingsResult,
	applySectionTimings,
	findTimingSources,
	sectionTimingAnchor,
} from "../utils/section-editing.ts";
import { getSectionBoundsById } from "../utils/section-system.ts";
import styles from "./ApplySectionTimingsDialog.module.css";

type Anchor = "section" | "playhead";

/** Below this, a source is folded under "Show more" unless it's in the repeat group. */
const STRONG_MATCH = 0.5;
/** Always show at least this many, so a song of loose matches still has a choice. */
const MIN_SHOWN = 3;

const displayLabel = (label: string) => label.replace(/^\[|\]$/g, "");

export function ApplySectionTimingsDialog() {
	const { t } = useTranslation();
	const [targetId, setTargetId] = useAtom(applyTimingsSectionIdAtom);
	const open = !!targetId;
	const lyrics = useLyricLinesWhileOpen(open);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const store = useStore();
	const target = lyrics.sections?.find((section) => section.id === targetId);
	const sources = useMemo(
		() => (targetId ? findTimingSources(lyrics, targetId) : []),
		[lyrics, targetId],
	);
	// Sections often share a name, so each row also shows where it starts and
	// how it opens.
	const choices = useMemo(
		() =>
			sources.map((candidate) => {
				const lines = lyrics.lyricLines;
				const bounds = getSectionBoundsById(lines, candidate.section.id);
				const firstLine = bounds
					? lines[bounds.start]?.words.map((word) => word.word).join("")
					: undefined;
				const start = sectionTimingAnchor(lyrics, candidate.section.id);
				return { candidate, firstLine, start };
			}),
		[sources, lyrics],
	);
	const sectionAnchor = targetId
		? sectionTimingAnchor(lyrics, targetId)
		: undefined;
	const playhead = open ? store.get(currentTimeAtom) : 0;
	const [sourceId, setSourceId] = useState<string>();
	const [showAll, setShowAll] = useState(false);
	// Remembered between uses. A section with no timed line can't start at its
	// own start, so it uses the playhead without changing what's remembered.
	const [savedAnchor, setSavedAnchor] = useAtom(sectionTimingsAnchorAtom);
	const anchor: Anchor = sectionAnchor === undefined ? "playhead" : savedAnchor;

	// Each opening starts from the best match, with weak ones folded away.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset per target only
	useEffect(() => {
		if (!targetId) return;
		setSourceId(sources[0]?.section.id);
		setShowAll(false);
	}, [targetId]);

	const strongCount = Math.max(
		MIN_SHOWN,
		choices.filter(
			({ candidate }) =>
				candidate.sameRepeatGroup || candidate.similarity >= STRONG_MATCH,
		).length,
	);
	const shown = showAll ? choices : choices.slice(0, strongCount);
	const hiddenCount = choices.length - shown.length;

	const close = () => setTargetId(null);

	const apply = () => {
		if (!targetId || !sourceId) return;
		const anchorMs =
			anchor === "section" && sectionAnchor !== undefined
				? sectionAnchor
				: store.get(currentTimeAtom);
		let result: ApplyTimingsResult | undefined;
		editLyrics((draft) => {
			result = applySectionTimings(draft, targetId, sourceId, anchorMs);
		});
		close();
		if (!result?.copiedLines) {
			toast.info(
				t(
					"sectionEditing.nothingMatched",
					"No lines in this section match that one, so nothing was copied.",
				),
			);
			return;
		}
		toast.success(
			t("sectionEditing.applied", {
				copied: result.copiedLines,
				total: result.totalLines,
				untimed: result.untimedWords,
			}),
		);
	};

	return (
		<Dialog.Root open={open} onOpenChange={(next) => !next && close()}>
			<Dialog.Content maxWidth="480px">
				<Dialog.Title>
					{t("sectionEditing.applyTitle", {
						name: target ? displayLabel(target.label) : "",
					})}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					{t(
						"sectionEditing.applyDesc",
						"Words that match get their timing from the section you pick. The rest keep theirs.",
					)}
				</Dialog.Description>
				<Flex direction="column" gap="4" mt="4">
					<Flex direction="column" gap="2">
						<Text as="div" size="2" weight="medium">
							{t("sectionEditing.source", "Copy from")}
						</Text>
						{sources.length === 0 ? (
							<Text size="2" color="gray">
								{t(
									"sectionEditing.noSources",
									"No other section has timings yet. Sync one first.",
								)}
							</Text>
						) : (
							<>
								<ChoiceList
									label={t("sectionEditing.source", "Copy from")}
									maxHeight="18rem"
									value={sourceId}
									onValueChange={setSourceId}
									choices={shown.map(({ candidate, firstLine, start }) => {
										const percent = Math.round(candidate.similarity * 100);
										return {
											value: candidate.section.id,
											title: displayLabel(candidate.section.label),
											meta:
												start === undefined ? undefined : msToTimestamp(start),
											detail: firstLine,
											trailing: (
												<span className={styles.match}>
													{t("sectionEditing.similarity", { percent })}
													<span
														className={styles.meter}
														data-strong={
															candidate.similarity >= STRONG_MATCH || undefined
														}
														aria-hidden
													>
														<span style={{ width: `${percent}%` }} />
													</span>
												</span>
											),
										};
									})}
								/>
								{hiddenCount > 0 && (
									<Button
										variant="ghost"
										color="gray"
										size="1"
										className={styles.showMore}
										onClick={() => setShowAll(true)}
									>
										{t("sectionEditing.showMore", { count: hiddenCount })}
									</Button>
								)}
							</>
						)}
					</Flex>
					<Flex direction="column" gap="2">
						<Text as="div" size="2" weight="medium">
							{t("sectionEditing.anchor", "Start at")}
						</Text>
						{sectionAnchor === undefined ? (
							<Text size="2" color="gray">
								{t("sectionEditing.anchorPlayheadOnly", {
									time: msToTimestamp(playhead),
								})}
							</Text>
						) : (
							<OptionPicker
								variant="segmented"
								size="2"
								fullWidth
								label={t("sectionEditing.anchor", "Start at")}
								value={anchor}
								onValueChange={setSavedAnchor}
								options={[
									{
										value: "section",
										label: t("sectionEditing.anchorSection", {
											time: msToTimestamp(sectionAnchor),
										}),
									},
									{
										value: "playhead",
										label: t("sectionEditing.anchorPlayhead", {
											time: msToTimestamp(playhead),
										}),
									},
								]}
							/>
						)}
					</Flex>
					<Text size="1" color="gray">
						{t(
							"sectionEditing.refineNote",
							"Copied timings are a starting point. Play the section back and fix what's off.",
						)}
					</Text>
					<Flex justify="end" gap="2">
						<Button variant="soft" color="gray" onClick={close}>
							{t("common.cancel", "Cancel")}
						</Button>
						<Button onClick={apply} disabled={!sourceId}>
							{t("sectionEditing.apply", "Apply")}
						</Button>
					</Flex>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
