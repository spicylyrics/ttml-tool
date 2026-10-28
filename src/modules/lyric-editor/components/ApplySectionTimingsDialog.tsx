import {
	Badge,
	Button,
	Dialog,
	Flex,
	RadioGroup,
	Text,
} from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import { currentTimeAtom } from "$/modules/audio/states/index.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";
import { sectionEditingEnabledAtom } from "../states/section-editing.ts";
import {
	type ApplyTimingsResult,
	applySectionTimings,
	findTimingSources,
	sectionTimingAnchor,
} from "../utils/section-editing.ts";

/** The section Apply timings from... was opened on, or null when closed. */
export const applyTimingsSectionIdAtom = atom<string | null>(null);

type Anchor = "section" | "playhead";

export function ApplySectionTimingsDialog() {
	const { t } = useTranslation();
	const enabled = useAtomValue(sectionEditingEnabledAtom);
	const [targetId, setTargetId] = useAtom(applyTimingsSectionIdAtom);
	const open = enabled && !!targetId;
	const lyrics = useLyricLinesWhileOpen(open);
	const editLyrics = useSetImmerAtom(lyricLinesAtom);
	const store = useStore();
	const target = lyrics.sections?.find((section) => section.id === targetId);
	const sources = useMemo(
		() => (targetId ? findTimingSources(lyrics, targetId) : []),
		[lyrics, targetId],
	);
	const sectionAnchor = targetId
		? sectionTimingAnchor(lyrics, targetId)
		: undefined;
	const playhead = open ? store.get(currentTimeAtom) : 0;
	const [sourceId, setSourceId] = useState<string>();
	const [anchor, setAnchor] = useState<Anchor>("section");

	// Each opening starts from the suggestion and the section's own start.
	// biome-ignore lint/correctness/useExhaustiveDependencies: reset per target only
	useEffect(() => {
		if (!targetId) return;
		setSourceId(sources[0]?.section.id);
		setAnchor(sectionAnchor === undefined ? "playhead" : "section");
	}, [targetId]);

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
					{t("sectionEditing.applyTitle", "Apply timings from another section")}
					{target && ` · ${target.label}`}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray">
					{t(
						"sectionEditing.applyDesc",
						"Copies another section's timing onto this one. Lines are matched by their words; only matching words get timings, the rest are left untimed.",
					)}
				</Dialog.Description>
				<Flex direction="column" gap="4" mt="4">
					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
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
							<RadioGroup.Root value={sourceId} onValueChange={setSourceId}>
								{sources.map((candidate) => (
									<RadioGroup.Item
										key={candidate.section.id}
										value={candidate.section.id}
									>
										<Flex gap="2" align="center" wrap="wrap">
											<Text>{candidate.section.label}</Text>
											<Text size="1" color="gray">
												{t("sectionEditing.similarity", {
													percent: Math.round(candidate.similarity * 100),
												})}
											</Text>
											{candidate.suggested && (
												<Badge size="1">
													{t("sectionEditing.suggested", "Suggested")}
												</Badge>
											)}
										</Flex>
									</RadioGroup.Item>
								))}
							</RadioGroup.Root>
						)}
					</Flex>
					<Flex direction="column" gap="2">
						<Text size="2" weight="bold">
							{t("sectionEditing.anchor", "Start at")}
						</Text>
						<RadioGroup.Root
							value={anchor}
							onValueChange={(value) => setAnchor(value as Anchor)}
						>
							<RadioGroup.Item
								value="section"
								disabled={sectionAnchor === undefined}
							>
								{t("sectionEditing.anchorSection", {
									time:
										sectionAnchor === undefined
											? "-"
											: msToTimestamp(sectionAnchor),
								})}
							</RadioGroup.Item>
							<RadioGroup.Item value="playhead">
								{t("sectionEditing.anchorPlayhead", {
									time: msToTimestamp(playhead),
								})}
							</RadioGroup.Item>
						</RadioGroup.Root>
					</Flex>
					<Text size="2" color="gray">
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
