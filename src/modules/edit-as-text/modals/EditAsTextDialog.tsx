import {
	Button,
	Dialog,
	Flex,
	ScrollArea,
	Text,
	VisuallyHidden,
} from "@radix-ui/themes";
import { useAtom, useStore } from "jotai";
import { useDeferredValue, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { LyricMarkupEditor } from "$/components/LyricMarkupEditor";
import { importTextFormatAtom } from "$/modules/lyrics-import/states";
import { geniusCategorizationEnabledAtom } from "$/modules/settings/states/index.ts";
import {
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";
import { error as logError } from "$/utils/logging.ts";
import { editTextFormat, serializeLyrics } from "../logic/serialize";
import { applyEditedText, type TextEditSummary } from "../logic/text-diff";
import { editAsTextDialogAtom } from "../states";
import styles from "./EditAsTextDialog.module.css";

const LOSSY_LINES_SHOWN = 8;

/**
 * Edit the whole project as import markup. Applying keeps the timing of every
 * word whose text didn't change, and lands as one undo step.
 */
export const EditAsTextDialog = () => {
	const [open, setOpen] = useAtom(editAsTextDialogAtom);
	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content className={styles.content} maxWidth="1120px">
				{open && <EditAsTextBody onDone={() => setOpen(false)} />}
			</Dialog.Content>
		</Dialog.Root>
	);
};

function EditAsTextBody({ onDone }: { onDone: () => void }) {
	const { t } = useTranslation();
	const store = useStore();
	// The text is written once when the dialog opens.
	const [{ format, original }] = useState(() => {
		const lyrics = store.get(lyricLinesAtom);
		const format = editTextFormat(lyrics, store.get(importTextFormatAtom));
		return { format, original: serializeLyrics(lyrics, format) };
	});
	const [text, setText] = useState(original);
	const deferredText = useDeferredValue(text);
	const summary = useMemo(() => {
		try {
			return applyEditedText(store.get(lyricLinesAtom), deferredText, format)
				.summary;
		} catch (e) {
			logError("Edit as text preview failed", e);
			return null;
		}
	}, [deferredText, format, store]);

	const apply = () => {
		try {
			const current = store.get(lyricLinesAtom);
			const result = applyEditedText(current, text, format);
			if (!result.summary.hasChanges) {
				onDone();
				return;
			}
			// One write, so one undo step.
			store.set(lyricLinesAtom, {
				...current,
				lyricLines: result.lyricLines,
				sections: result.sections,
			});
			if (result.sections.length && !current.sections?.length)
				store.set(geniusCategorizationEnabledAtom, true);
			const lineIds = new Set(result.lyricLines.map((line) => line.id));
			const wordIds = new Set(
				result.lyricLines.flatMap((line) => line.words.map((word) => word.id)),
			);
			store.set(
				selectedLinesAtom,
				new Set(
					[...store.get(selectedLinesAtom)].filter((id) => lineIds.has(id)),
				),
			);
			store.set(
				selectedWordsAtom,
				new Set(
					[...store.get(selectedWordsAtom)].filter((id) => wordIds.has(id)),
				),
			);
			toast.success(
				t(
					"editAsText.applied",
					"Applied the text. Undo reverts it in one step.",
				),
			);
			onDone();
		} catch (e) {
			logError("Edit as text failed", e);
			toast.error(
				t(
					"editAsText.failed",
					"Couldn't apply the text. Check it and try again.",
				),
			);
		}
	};

	return (
		<>
			<Dialog.Title mb="0">
				{t("editAsText.title", "Edit as text")}
			</Dialog.Title>
			<VisuallyHidden>
				<Dialog.Description>
					{t(
						"editAsText.description",
						"Edit the whole lyrics as plain text. Words you don't change keep their timing.",
					)}
				</Dialog.Description>
			</VisuallyHidden>

			<div className={styles.body}>
				<Flex direction="column" gap="2" className={styles.main}>
					<LyricMarkupEditor
						value={text}
						onChange={setText}
						format={format}
						ariaLabel={t("editAsText.textLabel", "Lyrics text")}
					/>
				</Flex>
				<ScrollArea type="auto" scrollbars="vertical" className={styles.side}>
					<div className={styles.sideInner}>
						<SummaryPanel summary={summary} />
					</div>
				</ScrollArea>
			</div>

			<Flex align="center" justify="end" gap="2">
				<Dialog.Close>
					<Button variant="soft" color="gray">
						{t("common.cancel", "Cancel")}
					</Button>
				</Dialog.Close>
				<Button onClick={apply} disabled={!summary?.hasChanges}>
					{t("editAsText.apply", "Apply")}
				</Button>
			</Flex>
		</>
	);
}

function SummaryPanel({ summary }: { summary: TextEditSummary | null }) {
	const { t } = useTranslation();
	if (!summary)
		return (
			<Text size="2" color="red">
				{t(
					"editAsText.failed",
					"Couldn't apply the text. Check it and try again.",
				)}
			</Text>
		);
	const rows = [
		{
			count: summary.unchanged,
			label: t(
				"editAsText.unchanged",
				"{count, plural, one {# line unchanged} other {# lines unchanged}}",
				{ count: summary.unchanged },
			),
		},
		{
			count: summary.edited,
			label: t(
				"editAsText.edited",
				"{count, plural, one {# line edited} other {# lines edited}}",
				{ count: summary.edited },
			),
			hint: t("editAsText.editedHint", "Timings are kept where words match."),
		},
		{
			count: summary.moved,
			label: t(
				"editAsText.moved",
				"{count, plural, one {# line moved} other {# lines moved}}",
				{ count: summary.moved },
			),
		},
		{
			count: summary.added,
			label: t(
				"editAsText.added",
				"{count, plural, one {# line added} other {# lines added}}",
				{ count: summary.added },
			),
		},
		{
			count: summary.removed,
			label: t(
				"editAsText.removed",
				"{count, plural, one {# line removed} other {# lines removed}}",
				{ count: summary.removed },
			),
		},
	];
	const lossy = summary.lossyLines.slice(0, LOSSY_LINES_SHOWN);
	const more = summary.lossyLines.length - lossy.length;

	return (
		<Flex direction="column" gap="4" aria-live="polite">
			<Flex direction="column" gap="2">
				<Text size="2" weight="medium">
					{t("editAsText.summaryTitle", "Changes")}
				</Text>
				{summary.hasChanges ? (
					<ul className={styles.list}>
						{rows
							.filter((row) => row.count > 0)
							.map((row) => (
								<li key={row.label}>
									<Text size="2">{row.label}</Text>
									{row.hint && (
										<Text as="p" size="1" color="gray">
											{row.hint}
										</Text>
									)}
								</li>
							))}
					</ul>
				) : (
					<Text size="2" color="gray">
						{t("editAsText.noChanges", "No changes yet.")}
					</Text>
				)}
			</Flex>

			{summary.droppedTimedWords > 0 && (
				<Flex direction="column" gap="2" className={styles.warning}>
					<Text size="2" weight="medium">
						{t(
							"editAsText.droppedTimings",
							"{count, plural, one {# timed word loses its timing} other {# timed words lose their timing}}",
							{ count: summary.droppedTimedWords },
						)}
					</Text>
					{lossy.length > 0 && (
						<ul className={styles.list}>
							{lossy.map((line) => (
								<li key={line.index} className={styles.lossyLine}>
									<Text size="1" color="gray" className={styles.lineNumber}>
										{t("editAsText.lineNumber", "Line {line}", {
											line: line.index + 1,
										})}
									</Text>
									<Text size="1" className={styles.lineText}>
										{line.text}
									</Text>
								</li>
							))}
							{more > 0 && (
								<li>
									<Text size="1" color="gray">
										{t(
											"editAsText.more",
											"{count, plural, other {and # more}}",
											{
												count: more,
											},
										)}
									</Text>
								</li>
							)}
						</ul>
					)}
				</Flex>
			)}

			<Text size="1" color="gray">
				{t(
					"editAsText.help",
					"New words come in untimed. Lines that only moved keep their timing. Apply is one undo step.",
				)}
			</Text>
		</Flex>
	);
}
