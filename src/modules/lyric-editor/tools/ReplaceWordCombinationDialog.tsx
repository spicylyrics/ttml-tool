import { ReOrderDotsVerticalRegular } from "@fluentui/react-icons";
import { Button, Checkbox, Dialog, Flex, Text } from "@radix-ui/themes";
import classNames from "classnames";
import { useAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useId, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { replaceWordCombinationDialogAtom } from "$/states/dialogs";
import { lyricLinesAtom } from "$/states/main";
import editorStyles from "../components/index.module.css";
import {
	getDisplayWordText,
	isWordBlankText,
} from "../components/lyric-word-view/word-text";
import styles from "./ReplaceWordCombinationDialog.module.css";
import {
	replaceWordCombination,
	type WordCombinationSelection,
} from "./replace-word-combination";

function ReplacementToken({
	token,
	index,
	changeText,
	move,
	startDrag,
	endDrag,
}: {
	token: WordCombinationSelection["words"][number];
	index: number;
	changeText: (value: string) => void;
	move: (index: number) => void;
	startDrag: (id: string) => void;
	endDrag: () => void;
}) {
	const { t } = useTranslation();
	const inputRef = useRef<HTMLInputElement>(null);
	const label = t("replaceWordCombinationDialog.word", {
		index: index + 1,
		defaultValue: "Word {index}",
	});
	const placeholder = getDisplayWordText(t, "", true);
	const displayText = getDisplayWordText(
		t,
		token.word,
		isWordBlankText(token.word),
	);

	return (
		<div
			className={styles.tokenBody}
			onKeyDown={(event) => {
				if (
					!event.altKey ||
					event.ctrlKey ||
					event.metaKey ||
					event.nativeEvent.isComposing ||
					(event.key !== "ArrowLeft" && event.key !== "ArrowRight")
				) {
					return;
				}
				event.preventDefault();
				move(index + (event.key === "ArrowLeft" ? -1 : 1));
			}}
		>
			<button
				type="button"
				className={styles.dragHandle}
				draggable
				aria-label={t("replaceWordCombinationDialog.reorderWord", {
					index: index + 1,
					defaultValue: "Reorder word {index}",
				})}
				aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
				onClick={() => inputRef.current?.focus()}
				onDragStart={(event) => {
					event.dataTransfer.effectAllowed = "move";
					event.dataTransfer.setData("text/plain", token.id);
					startDrag(token.id);
				}}
				onDragEnd={endDrag}
			>
				<ReOrderDotsVerticalRegular aria-hidden="true" />
			</button>
			<span className={classNames(editorStyles.wordMainText, styles.textField)}>
				<span aria-hidden="true" className={styles.textMeasure}>
					{token.word || placeholder}
				</span>
				<input
					ref={inputRef}
					autoFocus={index === 0}
					className={styles.tokenInput}
					value={token.word}
					aria-label={label}
					aria-keyshortcuts="Alt+ArrowLeft Alt+ArrowRight"
					title={displayText}
					placeholder={placeholder}
					onChange={(event) => changeText(event.currentTarget.value)}
				/>
			</span>
		</div>
	);
}

function ReplacementForm({
	selection,
	close,
}: {
	selection: WordCombinationSelection;
	close: () => void;
}) {
	const { t } = useTranslation();
	const instructionsId = useId();
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [tokens, setTokens] = useState(selection.words);
	const draggedId = useRef<string | null>(null);
	const [dropTarget, setDropTarget] = useState<{
		id: string;
		after: boolean;
	} | null>(null);
	const [announcement, setAnnouncement] = useState("");
	const [applyToAll, setApplyToAll] = useState(false);
	const [caseSensitive, setCaseSensitive] = useState(true);
	const moveToken = (id: string, index: number) => {
		const from = tokens.findIndex((token) => token.id === id);
		if (from === -1 || index < 0 || index >= tokens.length || from === index)
			return;
		const next = [...tokens];
		const [token] = next.splice(from, 1);
		next.splice(index, 0, token);
		setTokens(next);
		setAnnouncement(
			t("replaceWordCombinationDialog.position", {
				index: index + 1,
				count: next.length,
				defaultValue: "Position {index} of {count}",
			}),
		);
	};
	const endDrag = () => {
		draggedId.current = null;
		setDropTarget(null);
	};

	return (
		<form
			onSubmit={(event) => {
				event.preventDefault();
				editLyricLines((state) => {
					replaceWordCombination(
						state.lyricLines,
						selection,
						tokens.map(({ word }) => word),
						applyToAll,
						caseSensitive,
					);
				});
				close();
			}}
		>
			<Flex direction="column" gap="3">
				<div
					className={classNames(
						editorStyles.lyricWordsContainer,
						editorStyles.edit,
						styles.tokens,
					)}
					role="group"
					aria-label={t("replaceWordCombinationDialog.title")}
					aria-describedby={instructionsId}
					onDragLeave={(event) => {
						if (
							!event.currentTarget.contains(event.relatedTarget as Node | null)
						)
							setDropTarget(null);
					}}
				>
					{tokens.map((token, index) => (
						<div
							key={token.id}
							className={classNames(
								editorStyles.lyricWord,
								editorStyles.edit,
								styles.token,
								dropTarget?.id === token.id &&
									(dropTarget.after
										? editorStyles.dropRight
										: editorStyles.dropLeft),
							)}
							onDragOver={(event) => {
								if (!draggedId.current) return;
								event.preventDefault();
								if (draggedId.current === token.id) {
									setDropTarget(null);
									return;
								}
								event.dataTransfer.dropEffect = "move";
								const bounds = event.currentTarget.getBoundingClientRect();
								setDropTarget({
									id: token.id,
									after: event.clientX > bounds.left + bounds.width / 2,
								});
							}}
							onDrop={(event) => {
								if (!draggedId.current) return;
								event.preventDefault();
								event.stopPropagation();
								if (dropTarget?.id !== token.id) {
									endDrag();
									return;
								}
								const from = tokens.findIndex(
									({ id }) => id === draggedId.current,
								);
								const insertion = index + (dropTarget.after ? 1 : 0);
								moveToken(
									draggedId.current,
									insertion - (from < insertion ? 1 : 0),
								);
								endDrag();
							}}
						>
							<ReplacementToken
								token={token}
								index={index}
								changeText={(value) =>
									setTokens((current) =>
										current.map((item) =>
											item.id === token.id ? { ...item, word: value } : item,
										),
									)
								}
								move={(to) => moveToken(token.id, to)}
								startDrag={(id) => {
									draggedId.current = id;
								}}
								endDrag={endDrag}
							/>
						</div>
					))}
				</div>
				<Text id={instructionsId} size="1" color="gray">
					{t(
						"replaceWordCombinationDialog.reorderHint",
						"Drag a handle to reorder, or focus a token and press Alt+Left/Right.",
					)}
				</Text>
				<span role="status" className={styles.status}>
					{announcement}
				</span>
				<Flex direction="column" gap="2">
					<Text as="label" size="2">
						<Flex gap="2" align="center">
							<Checkbox
								checked={applyToAll}
								onCheckedChange={(checked) => setApplyToAll(checked === true)}
							/>
							{t(
								"replaceWordCombinationDialog.applyToAll",
								"Replace all matching combinations",
							)}
						</Flex>
					</Text>
					<Text as="label" size="2" color={applyToAll ? undefined : "gray"}>
						<Flex gap="2" align="center">
							<Checkbox
								checked={caseSensitive}
								onCheckedChange={(checked) =>
									setCaseSensitive(checked === true)
								}
								disabled={!applyToAll}
							/>
							{t("replaceWordDialog.caseSensitive", "Match case")}
						</Flex>
					</Text>
				</Flex>
			</Flex>
			<Flex gap="3" mt="4" justify="end" wrap="wrap">
				<Dialog.Close>
					<Button type="button" variant="soft" color="gray">
						{t("common.cancel", "Cancel")}
					</Button>
				</Dialog.Close>
				<Button type="submit">{t("common.confirm", "Confirm")}</Button>
			</Flex>
		</form>
	);
}

export const ReplaceWordCombinationDialog = memo(() => {
	const { t } = useTranslation();
	const [dialog, setDialog] = useAtom(replaceWordCombinationDialogAtom);
	const close = () => setDialog({ open: false, selection: null });

	return (
		<Dialog.Root
			open={dialog.open}
			onOpenChange={(open) => {
				if (!open) close();
			}}
		>
			<Dialog.Content maxWidth="560px">
				<Dialog.Title>
					{t("replaceWordCombinationDialog.title", "Replace word combination")}
				</Dialog.Title>
				<Dialog.Description size="2" mb="4">
					{dialog.selection
						? t(
								"replaceWordCombinationDialog.description",
								"Click a token to edit its text. Timing stays the same.",
							)
						: t(
								"replaceWordCombinationDialog.adjacentOnly",
								"Select adjacent words or syllables in one line to replace a combination.",
							)}
				</Dialog.Description>
				{dialog.open && dialog.selection ? (
					<ReplacementForm selection={dialog.selection} close={close} />
				) : (
					<Flex justify="end">
						<Dialog.Close>
							<Button variant="soft" color="gray">
								{t("common.cancel", "Cancel")}
							</Button>
						</Dialog.Close>
					</Flex>
				)}
			</Dialog.Content>
		</Dialog.Root>
	);
});
