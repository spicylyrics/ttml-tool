import {
	BugRegular,
	CheckmarkRegular,
	CopyRegular,
	LightbulbRegular,
	OpenRegular,
} from "@fluentui/react-icons";
import { Button, Dialog, Flex, Link, Text } from "@radix-ui/themes";
import { useAtom, useStore } from "jotai";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { OptionPicker } from "$/components/OptionPicker";
import { openExternal } from "$/modules/settings/modals/about/externalLinks";
import { reportDialogAtom } from "$/states/dialogs";
import { collectReportInfo, redactForReport } from "./collect";
import styles from "./index.module.css";
import {
	buildReport,
	DISCORD_FORUM_URL,
	issueUrl,
	MAX_ISSUE_URL,
	type ReportInfo,
	type ReportKind,
} from "./report";

/** Help › Report a problem / Suggest something: GitHub, or copy for Discord. */
export const ReportDialog = () => {
	const [kind, setKind] = useAtom(reportDialogAtom);
	const store = useStore();
	const { t } = useTranslation();
	const [info, setInfo] = useState<ReportInfo | null>(null);
	const [copied, setCopied] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const open = kind !== null;

	useEffect(() => {
		if (!open) return;
		setInfo(null);
		setNotice(null);
		void collectReportInfo(store).then(setInfo);
	}, [open, store]);

	useEffect(() => {
		if (!copied) return;
		const timer = setTimeout(() => setCopied(false), 2000);
		return () => clearTimeout(timer);
	}, [copied]);

	const current: ReportKind = kind ?? "problem";
	const details = info
		? redactForReport(buildReport(current, info), store)
		: "";

	const copy = async () => {
		try {
			await navigator.clipboard.writeText(details);
			setCopied(true);
		} catch {
			setNotice(
				t(
					"reportDialog.copyFailed",
					"Couldn't copy. Select the details and copy them yourself.",
				),
			);
		}
	};

	const openGitHub = async () => {
		if (!info) return;
		let url = issueUrl(current, info, details);
		if (url.length > MAX_ISSUE_URL) {
			// Too long for a link: send the short part, put the whole report on the clipboard.
			const short = redactForReport(
				buildReport(current, info, { includeErrors: false }),
				store,
			);
			url = issueUrl(current, info, short);
			try {
				await navigator.clipboard.writeText(details);
				setNotice(
					t(
						"reportDialog.tooLong",
						"The recent errors didn't fit in the link, so all the details are on your clipboard. Paste them into the issue.",
					),
				);
			} catch {}
		}
		await openExternal(url);
	};

	const problem = current === "problem";

	return (
		<Dialog.Root open={open} onOpenChange={(next) => !next && setKind(null)}>
			<Dialog.Content maxWidth="560px">
				<Dialog.Title>
					{problem
						? t("reportDialog.problemTitle", "Report a problem")
						: t("reportDialog.suggestionTitle", "Suggest something")}
				</Dialog.Title>
				<Flex direction="column" gap="3">
					<OptionPicker
						variant="segmented"
						value={current}
						onValueChange={setKind}
						label={t("reportDialog.kind", "What to send")}
						options={[
							{
								value: "problem",
								label: t("reportDialog.problem", "Problem"),
							},
							{
								value: "suggestion",
								label: t("reportDialog.suggestion", "Suggestion"),
							},
						]}
					/>
					<Text as="p" size="2">
						{problem
							? t(
									"reportDialog.problemIntro",
									"Opens a bug report on GitHub with these details already filled in. Describe what you did and what went wrong there.",
								)
							: t(
									"reportDialog.suggestionIntro",
									"Opens a feature request on GitHub with these details already filled in. Describe what you'd like there.",
								)}
					</Text>
					<Flex direction="column" gap="1">
						<Text as="div" size="2" weight="medium" id="report-details-label">
							{t("reportDialog.details", "Details from the app")}
						</Text>
						<pre
							className={styles.details}
							aria-labelledby="report-details-label"
							// Scrolls, so it has to be reachable by keyboard.
							tabIndex={0}
						>
							{info
								? details
								: t("reportDialog.collecting", "Collecting details...")}
						</pre>
						<Text as="div" size="1" color="gray">
							{t(
								"reportDialog.hidden",
								"Keys, tokens, link details and your user folder name are hidden.",
							)}
						</Text>
					</Flex>
					<Text as="p" size="2" color="gray">
						{t(
							"reportDialog.discordHint",
							"No GitHub account? Copy the details and post them in the #ttml-tool forum on the Spicy Lyrics Discord.",
						)}{" "}
						<Link
							href={DISCORD_FORUM_URL}
							onClick={(event) => {
								event.preventDefault();
								void openExternal(DISCORD_FORUM_URL);
							}}
						>
							{t("reportDialog.openForum", "Open the forum")}
						</Link>
					</Text>
					{notice && (
						<Text as="p" size="2" role="status">
							{notice}
						</Text>
					)}
				</Flex>
				<Flex gap="3" mt="4" justify="end" wrap="wrap">
					<Button
						variant="soft"
						color="gray"
						disabled={!info}
						onClick={() => void copy()}
					>
						{copied ? <CheckmarkRegular /> : <CopyRegular />}
						{copied
							? t("reportDialog.copied", "Copied")
							: t("reportDialog.copy", "Copy details")}
					</Button>
					<Button disabled={!info} onClick={() => void openGitHub()}>
						{problem ? <BugRegular /> : <LightbulbRegular />}
						{t("reportDialog.openGitHub", "Open on GitHub")}
						<OpenRegular />
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
