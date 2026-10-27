import { ErrorCircle16Regular } from "@fluentui/react-icons";
import {
	Button,
	Callout,
	Dialog,
	Flex,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	ProblemList,
	type ProblemListItem,
} from "$/components/ProblemList/index.tsx";
import { metadataEditorDialogAtom } from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import { msToTimestamp } from "$/utils/timestamp.ts";
import { guideLinkFor } from "./guide-links";
import { lintLyric } from "./lint";
import {
	focusLyric,
	lintOptionsAtom,
	lintResultAtom,
	problemsDialogAtom,
} from "./states";

// Long enough to skip every keystroke, short enough to feel live.
const LINT_DELAY_MS = 700;

const SONGWRITER_RULES = new Set([
	"songwriters-missing",
	"songwriter-empty",
	"songwriter-several-names",
	"songwriter-duplicate",
]);

const whenIdle = (run: () => void) =>
	typeof requestIdleCallback === "function"
		? requestIdleCallback(run, { timeout: 2000 })
		: window.setTimeout(run, 0);

const cancelIdle = (handle: number) =>
	typeof cancelIdleCallback === "function"
		? cancelIdleCallback(handle)
		: window.clearTimeout(handle);

/** Lints after edits settle, off the typing path. Renders nothing itself. */
function useLiveLint() {
	const store = useStore();
	useEffect(() => {
		let timer: number | undefined;
		let idle: number | undefined;
		const run = () => {
			idle = undefined;
			store.set(
				lintResultAtom,
				lintLyric(store.get(lyricLinesAtom), store.get(lintOptionsAtom)),
			);
		};
		const schedule = () => {
			window.clearTimeout(timer);
			if (idle !== undefined) cancelIdle(idle);
			timer = window.setTimeout(() => {
				idle = whenIdle(run);
			}, LINT_DELAY_MS);
		};
		schedule();
		const unsubscribe = [
			store.sub(lyricLinesAtom, schedule),
			store.sub(lintOptionsAtom, schedule),
		];
		return () => {
			window.clearTimeout(timer);
			if (idle !== undefined) cancelIdle(idle);
			for (const stop of unsubscribe) stop();
		};
	}, [store]);
}

function ProblemsContent() {
	const { t } = useTranslation();
	const store = useStore();
	const result = useAtomValue(lintResultAtom);
	const lyric = useAtomValue(lyricLinesAtom);
	const setOpen = useSetAtom(problemsDialogAtom);
	const setMetadataOpen = useSetAtom(metadataEditorDialogAtom);
	const [showHints, setShowHints] = useState(false);

	const lineNumbers = useMemo(
		() => new Map(lyric.lyricLines.map((line, index) => [line.id, index + 1])),
		[lyric],
	);

	const items = useMemo((): ProblemListItem[] => {
		if (!result) return [];
		const position = (lineId?: string) =>
			(lineId && lineNumbers.get(lineId)) || 0;
		return [...result.problems]
			.sort(
				(a, b) =>
					position(a.lineId) - position(b.lineId) ||
					(a.timeMs ?? 0) - (b.timeMs ?? 0),
			)
			.map((problem) => {
				const line = problem.lineId
					? lineNumbers.get(problem.lineId)
					: undefined;
				const parts: string[] = [];
				if (line) parts.push(t("linter.line", "Line {line}", { line }));
				if (problem.timeMs != null) parts.push(msToTimestamp(problem.timeMs));
				const songwriters = SONGWRITER_RULES.has(problem.rule);
				return {
					key: problem.key,
					severity: problem.severity,
					message: problem.i18n
						? t(problem.i18n.key, problem.message, problem.i18n.params)
						: problem.message,
					location: parts.join(" · ") || undefined,
					detail: problem.rule,
					href: guideLinkFor(problem.rule),
					onSelect: problem.lineId
						? () => focusLyric(store, problem)
						: songwriters
							? () => {
									setOpen(false);
									setMetadataOpen(true);
								}
							: undefined,
				};
			});
	}, [result, lineNumbers, t, store, setOpen, setMetadataOpen]);

	if (!result)
		return (
			<Text size="2" color="gray">
				{t("linter.checking", "Checking...")}
			</Text>
		);
	if (result.failed)
		return (
			<Text size="2" color="gray">
				{t("linter.failed", "The checker couldn't run on this project.")}
			</Text>
		);

	const { counts } = result;
	return (
		<Flex direction="column" gap="3">
			{!result.loads && (
				<Callout.Root color="red" size="1">
					<Callout.Icon>
						<ErrorCircle16Regular />
					</Callout.Icon>
					<Callout.Text>
						{t(
							"linter.wontLoad",
							"Spicy Lyrics can't load this file as it is.",
						)}
					</Callout.Text>
				</Callout.Root>
			)}
			{items.length === 0 ? (
				<Text size="2" color="gray">
					{t("linter.none", "No problems found.")}
				</Text>
			) : (
				<ScrollArea
					type="auto"
					scrollbars="vertical"
					style={{ maxHeight: "60vh" }}
				>
					<ProblemList
						items={items}
						hidden={showHints ? [] : ["hint"]}
						linkLabel={t("linter.openGuide", "Open the guide for this rule")}
						headings={{
							error: (count) =>
								t(
									"linter.errors",
									"{count, plural, one {# error} other {# errors}}",
									{
										count,
									},
								),
							warning: (count) =>
								t(
									"linter.warnings",
									"{count, plural, one {# warning} other {# warnings}}",
									{ count },
								),
							hint: (count) =>
								t(
									"linter.hints",
									"{count, plural, one {# hint} other {# hints}}",
									{
										count,
									},
								),
						}}
					/>
				</ScrollArea>
			)}
			{counts.error + counts.warning === 0 && counts.hint > 0 && !showHints && (
				<Text size="2" color="gray">
					{t("linter.onlyHints", "No errors or warnings.")}
				</Text>
			)}
			{result.omitted > 0 && (
				<Text size="1" color="gray">
					{t(
						"linter.omitted",
						"{count, plural, one {# more finding isn't listed. Fix the ones above first.} other {# more findings aren't listed. Fix the ones above first.}}",
						{ count: result.omitted },
					)}
				</Text>
			)}
			<Flex justify="between" align="center" gap="3" wrap="wrap">
				<Text size="1" color="gray">
					{t(
						"linter.englishNote",
						"Messages are in English so they match the Spicy Lyrics review bot.",
					)}
				</Text>
				{counts.hint > 0 && (
					<Button
						size="1"
						variant="soft"
						color="gray"
						onClick={() => setShowHints((value) => !value)}
					>
						{showHints
							? t("linter.hideHints", "Hide hints")
							: t(
									"linter.showHints",
									"{count, plural, one {Show # hint} other {Show # hints}}",
									{ count: counts.hint },
								)}
					</Button>
				)}
			</Flex>
		</Flex>
	);
}

export const ProblemsDialog = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(problemsDialogAtom);
	useLiveLint();

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content maxWidth="640px">
				<Dialog.Title>{t("linter.title", "Problems")}</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="3">
					{t(
						"linter.description",
						"What the Spicy Lyrics review bot would report for this export. Select a problem to jump to its line.",
					)}
				</Dialog.Description>
				{open && <ProblemsContent />}
				<Flex justify="end" mt="4">
					<Dialog.Close>
						<Button variant="soft" color="gray">
							{t("common.close", "Close")}
						</Button>
					</Dialog.Close>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
