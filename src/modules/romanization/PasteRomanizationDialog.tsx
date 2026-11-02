import { ErrorCircle16Regular } from "@fluentui/react-icons";
import { Button, Dialog, Flex, Text, TextArea } from "@radix-ui/themes";
import { useAtom, useAtomValue, useStore } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import { memo, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { ChoiceList } from "$/components/ChoiceList";
import { lyricLinesAtom } from "$/states/main";
import { alignableLines, alignRomanizedPage } from "./align-romanized";
import { pasteRomanizationDialogAtom } from "./states";

type ExistingMode = "fillEmpty" | "replace";

/** Fills per-word romanization from a pasted romanized lyric page. */
export const PasteRomanizationDialog = memo(() => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(pasteRomanizationDialogAtom);
	const store = useStore();
	const lyricLines = useAtomValue(lyricLinesAtom).lyricLines;
	const editLyricLines = useSetImmerAtom(lyricLinesAtom);
	const [text, setText] = useState("");
	const [problem, setProblem] = useState("");
	const [mode, setMode] = useState<ExistingMode>("fillEmpty");

	const existingCount = useMemo(
		() =>
			open
				? alignableLines(lyricLines).reduce(
						(count, line) =>
							count + line.words.filter((word) => word.romanWord.trim()).length,
						0,
					)
				: 0,
		[open, lyricLines],
	);

	useEffect(() => {
		if (open) {
			setProblem("");
			setMode("fillEmpty");
		}
	}, [open]);

	const apply = () => {
		const result = alignRomanizedPage(
			store.get(lyricLinesAtom).lyricLines,
			text,
		);
		if (!result.ok) {
			setProblem(
				t(
					"romanizationTools.paste.lineCountMismatch",
					"The page has {received} lines and the lyrics have {expected}. Add or remove lines so they match.",
					{ received: result.received, expected: result.expected },
				),
			);
			return;
		}
		const replace = existingCount === 0 || mode === "replace";
		const byLine = new Map(result.lines.map((line) => [line.lineId, line]));
		editLyricLines((draft) => {
			for (const line of draft.lyricLines) {
				const aligned = byLine.get(line.id);
				if (!aligned) continue;
				for (const word of line.words) {
					if (!replace && word.romanWord.trim()) continue;
					word.romanWord = aligned.romanWords[word.id] ?? word.romanWord;
				}
			}
		});
		const uncertain = result.lines
			.filter((line) => line.uncertain)
			.map((line) => line.lineNumber);
		toast.success(
			t(
				"romanizationTools.paste.applied",
				"{count, plural, one {Romanization filled for # line.} other {Romanization filled for # lines.}}",
				{ count: result.lines.length },
			),
		);
		if (uncertain.length > 0) {
			toast.warn(
				t(
					"romanizationTools.paste.check",
					"Some words were guessed. Check lines {lines}.",
					{ lines: uncertain.join(", ") },
				),
			);
		}
		setText("");
		setOpen(false);
	};

	const existingLabel = t(
		"romanizationTools.paste.existing",
		"{count, plural, one {# word already has romanization} other {# words already have romanization}}",
		{ count: existingCount },
	);

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="520px">
				<Dialog.Title>
					{t("romanizationTools.paste.title", "Paste romanized lyrics")}
				</Dialog.Title>
				<Dialog.Description size="2" mb="3">
					{t(
						"romanizationTools.paste.description",
						"Paste a romanized lyric page, one line per lyric line. Section headers and blank lines are skipped, and background lines are left alone.",
					)}
				</Dialog.Description>
				<Flex direction="column" gap="3">
					<TextArea
						value={text}
						onChange={(event) => {
							setText(event.currentTarget.value);
							setProblem("");
						}}
						placeholder={t(
							"romanizationTools.paste.placeholder",
							"Kimi no na wo...",
						)}
						aria-label={t(
							"romanizationTools.paste.title",
							"Paste romanized lyrics",
						)}
						rows={12}
						autoFocus
					/>
					{existingCount > 0 && (
						<Flex direction="column" gap="2">
							<Text size="2" weight="medium">
								{existingLabel}
							</Text>
							<ChoiceList<ExistingMode>
								label={existingLabel}
								value={mode}
								onValueChange={setMode}
								choices={[
									{
										value: "fillEmpty",
										title: t(
											"romanizationTools.paste.fillEmpty",
											"Fill empty words only",
										),
										detail: t(
											"romanizationTools.paste.fillEmptyDesc",
											"Words you already romanized stay as they are",
										),
									},
									{
										value: "replace",
										title: t("romanizationTools.paste.replace", "Replace all"),
										detail: t(
											"romanizationTools.paste.replaceDesc",
											"Every word takes its romanization from the page",
										),
									},
								]}
							/>
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
				<Flex gap="3" mt="4" justify="end">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.cancel", "Cancel")}
						</Button>
					</Dialog.Close>
					<Button onClick={apply} disabled={!text.trim()}>
						{t("romanizationTools.paste.apply", "Fill romanization")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
});
