import { Checkmark16Regular, Dismiss16Regular } from "@fluentui/react-icons";
import {
	Button,
	Dialog,
	Flex,
	ScrollArea,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import type { JoinedBackgroundRow } from "$/modules/project/logic/text-to-lines";
import styles from "./index.module.css";

interface JoinedBackgroundReviewProps {
	/** The rows to review; the dialog is open while there are any. */
	rows: JoinedBackgroundRow[];
	/** Called with the edited text of every row, by 0-based source row. */
	onApply: (edits: Map<number, string>) => void;
	/** Keeps the automatic result. */
	onKeep: () => void;
}

/**
 * Lists the lines where Process lyrics joined ad-libs from between the words
 * into one background line, so the user can fix capitals and commas.
 */
export function JoinedBackgroundReview({
	rows,
	onApply,
	onKeep,
}: JoinedBackgroundReviewProps) {
	const { t } = useTranslation();
	const [drafts, setDrafts] = useState<string[]>([]);
	useEffect(() => setDrafts(rows.map((row) => row.suggestion)), [rows]);

	const apply = () =>
		onApply(new Map(rows.map((row, index) => [row.row, drafts[index] ?? ""])));

	return (
		<Dialog.Root
			open={rows.length > 0}
			onOpenChange={(open) => !open && onKeep()}
		>
			<Dialog.Content maxWidth="600px">
				<Dialog.Title>
					{t("joinedBackground.title", "Check joined ad-libs")}
				</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="4">
					{t(
						"joinedBackground.description",
						"{count, plural, one {# line had ad-libs between its words.} other {# lines had ad-libs between their words.}} They were joined into one background line, with every part after the first in lowercase. Fix names, capitals and extra commas. Brackets at the end become the background line.",
						{ count: rows.length },
					)}
				</Dialog.Description>
				<ScrollArea type="auto" scrollbars="vertical" className={styles.scroll}>
					<ol className={styles.list}>
						{rows.map((row, index) => {
							const id = `joined-background-${row.row}`;
							return (
								<li key={row.row} className={styles.item}>
									<label htmlFor={id} className={styles.source}>
										<Text size="1" color="gray" className={styles.number}>
											{row.row + 1}
										</Text>
										<Text size="2" color="gray" className={styles.sourceText}>
											{row.source}
										</Text>
									</label>
									<TextField.Root
										id={id}
										size="2"
										value={drafts[index] ?? ""}
										spellCheck={false}
										onChange={(event) => {
											const value = event.currentTarget.value;
											setDrafts((current) =>
												current.map((draft, at) =>
													at === index ? value : draft,
												),
											);
										}}
										onKeyDown={(event) => {
											if (event.key === "Enter") apply();
										}}
									/>
								</li>
							);
						})}
					</ol>
				</ScrollArea>
				<Flex gap="2" mt="4" justify="end">
					<Button variant="soft" color="gray" onClick={onKeep}>
						<Dismiss16Regular />
						{t("joinedBackground.keep", "Keep as processed")}
					</Button>
					<Button onClick={apply}>
						<Checkmark16Regular />
						{t("joinedBackground.apply", "Apply edits")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
}
