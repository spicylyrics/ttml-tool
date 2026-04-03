import { BUILD_TIME, GIT_COMMIT } from "virtual:buildmeta";
import {
	CheckmarkCircle24Regular,
	CloudArrowDown24Regular,
} from "@fluentui/react-icons";
import {
	Badge,
	Box,
	Button,
	Card,
	Flex,
	Heading,
	Link,
	Progress,
	Text,
} from "@radix-ui/themes";
import { useTranslation } from "react-i18next";
import { useAppUpdate } from "$/utils/useAppUpdate";

export const SettingsAboutTab = () => {
	const { t } = useTranslation();
	const { status, update, progress, installUpdate } = useAppUpdate();

	const showUpdateCard = ["available", "downloading", "ready"].includes(status);

	return (
		<Flex direction="column" gap="4">
			<Flex direction="column" gap="1">
				<Heading size="4">
					{t("aboutModal.appName", "Apple Music-like lyrics TTML Tools")}
				</Heading>
				<Text as="div" size="2" color="gray">
					{t(
						"aboutModal.description",
						"A TTML lyric and timing editor designed for the Apple Music-like lyrics ecosystem",
					)}
				</Text>
			</Flex>

			<Card>
				<Flex direction="column" gap="2">
					<Flex direction="column" gap="1">
						<Text as="div" size="2">
							{t("aboutModal.buildDate", "Build Date: {date}", {
								date: BUILD_TIME,
							})}
						</Text>
						<Text as="div" size="2">
							{t("aboutModal.gitCommit", "Git Commit: {commit}", {
								commit:
									GIT_COMMIT === "unknown" ? (
										t("aboutModal.unknown", "Unknown")
									) : (
										<Link
											href={`https://github.com/amll-dev/amll-ttml-tool/commit/${GIT_COMMIT}`}
											target="_blank"
											rel="noreferrer"
										>
											{GIT_COMMIT}
										</Link>
									),
							})}
						</Text>
					</Flex>
				</Flex>
			</Card>

			{showUpdateCard && (
				<Card>
					<Flex direction="column" gap="3">
						<Flex align="center" gap="2">
							<Heading size="3">
								{t("settings.about.update", "Software Update")}
							</Heading>
							{status === "available" && (
								<Badge color="ruby">
									{t("settings.about.newVersion", "New Version")}
								</Badge>
							)}
						</Flex>

						<Box>
							{status === "available" && update && (
								<Flex direction="column" gap="3">
									<Flex
										direction="column"
										gap="1"
										style={{
											padding: "8px",
											background: "var(--gray-3)",
											borderRadius: "6px",
										}}
									>
										<Text weight="bold" size="2">
											{update.version}
										</Text>
										<Text size="1" style={{ whiteSpace: "pre-wrap" }}>
											{update.body}
										</Text>
									</Flex>
									<Flex gap="3">
										<Button onClick={installUpdate}>
											<CloudArrowDown24Regular />
											{t("settings.about.updateNow", "Update Now")}
										</Button>
									</Flex>
								</Flex>
							)}

							{status === "downloading" && (
								<Flex direction="column" gap="2">
									<Flex justify="between">
										<Text size="2">
											{t("settings.about.downloading", "Downloading update...")}
										</Text>
										<Text size="2">{progress.toFixed(0)}%</Text>
									</Flex>
									<Progress value={progress} />
								</Flex>
							)}

							{status === "ready" && (
								<Flex direction="column" gap="2">
									<Flex align="center" gap="2">
										<CheckmarkCircle24Regular color="var(--ruby-9)" />
										<Text size="2">
											{t(
												"settings.about.ready",
												"Update ready, restart application to apply",
											)}
										</Text>
									</Flex>
									<Button onClick={() => window.location.reload()}>
										{t("settings.about.restart", "Restart Application")}
									</Button>
								</Flex>
							)}
						</Box>
					</Flex>
				</Card>
			)}
		</Flex>
	);
};
