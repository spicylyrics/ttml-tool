import { DismissRegular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Dialog,
	Flex,
	Heading,
	ScrollArea,
	Text,
} from "@radix-ui/themes";
import { open } from "@tauri-apps/plugin-shell";
import { useAtom, useAtomValue } from "jotai";
import { useTranslation } from "react-i18next";
import changelog from "$/data/changelog.json";
import legacy from "$/data/changelog-legacy.json";
import { ChangelogScreen } from "$/modules/changelog/ChangelogScreen.tsx";
import { changelogScreenAtom } from "$/modules/changelog/states.ts";
import { changelogDialogAtom } from "$/states/dialogs.ts";
import { ChangeMarkdown, releaseColor } from "./change-notes.tsx";

export function ChangelogDialog() {
	const { t } = useTranslation();
	const [isOpen, setIsOpen] = useAtom(changelogDialogAtom);
	const useNewScreen = useAtomValue(changelogScreenAtom);

	const openGitHub = async () => {
		const repoUrl = "https://github.com/spicylyrics/ttml-tool/commits/main";
		if (import.meta.env.TAURI_ENV_PLATFORM) {
			await open(repoUrl);
		} else {
			window.open(repoUrl, "_blank");
		}
	};

	if (useNewScreen)
		return (
			<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
				<ChangelogScreen onOpenCommits={openGitHub} />
			</Dialog.Root>
		);

	return (
		<Dialog.Root open={isOpen} onOpenChange={setIsOpen}>
			<Dialog.Content style={{ maxWidth: 650, height: "70vh", maxHeight: 600 }}>
				<Flex justify="between" align="center" mb="4">
					<Flex align="center" gap="3">
						<Dialog.Title mb="0">
							{t("changeNotes.changelogTitle", "Changelog & updates")}
						</Dialog.Title>
						<Button
							variant="soft"
							size="1"
							color="indigo"
							onClick={openGitHub}
							style={{ cursor: "pointer" }}
						>
							{t("changeNotes.viewCommits", "View Commits on GitHub")}
						</Button>
					</Flex>
					<Dialog.Close>
						<Button variant="ghost" color="gray">
							<DismissRegular />
						</Button>
					</Dialog.Close>
				</Flex>

				<ScrollArea
					type="always"
					scrollbars="vertical"
					style={{ height: "calc(100% - 60px)" }}
				>
					<Flex direction="column" gap="5" pr="4">
						{[
							...changelog.map((release) => ({
								...release,
								heading:
									release.heading ??
									`v${release.version} Updates (${release.summary})`,
							})),
							{ ...legacy, heading: legacy.summary },
						].map((release) => (
							<Box key={release.heading}>
								<Heading size="4" mb="2" color={releaseColor(release.color)}>
									{release.heading}
								</Heading>
								<Flex direction="column" gap="3">
									{release.entries.map((entry) => (
										<Text size="2" key={`${entry.title}:${entry.body ?? ""}`}>
											<strong>
												<ChangeMarkdown text={entry.title} />
												{entry.body ? ":" : ""}
											</strong>
											{entry.body && (
												<>
													{" "}
													<ChangeMarkdown text={entry.body} />
												</>
											)}
										</Text>
									))}
								</Flex>
							</Box>
						))}
					</Flex>
				</ScrollArea>
			</Dialog.Content>
		</Dialog.Root>
	);
}
