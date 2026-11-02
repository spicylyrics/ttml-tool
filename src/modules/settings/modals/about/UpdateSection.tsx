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
	Progress,
	Text,
} from "@radix-ui/themes";
import type { AboutSettings } from "./useAboutSettings";
export const UpdateSection = ({
	t,
	status,
	update,
	progress,
	installUpdate,
	restartApp,
	showUpdateCard,
}: Pick<
	AboutSettings,
	| "t"
	| "status"
	| "update"
	| "progress"
	| "installUpdate"
	| "restartApp"
	| "showUpdateCard"
>) =>
	showUpdateCard && (
		<Card>
			<Flex direction="column" gap="3">
				<Flex align="center" gap="2">
					<Heading size="3">
						{t("settings.about.update", "Software Update")}
					</Heading>
					{status === "available" && (
						<Badge color="crimson">
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
									{t("settings.about.downloading", "Downloading update…")}
								</Text>
								<Text size="2">{progress.toFixed(0)}%</Text>
							</Flex>
							<Progress value={progress} />
						</Flex>
					)}

					{status === "ready" && (
						<Flex direction="column" gap="2">
							<Flex align="center" gap="2">
								<CheckmarkCircle24Regular color="var(--crimson-9)" />
								<Text size="2">
									{t(
										"settings.about.ready",
										"Update ready, restart application to apply",
									)}
								</Text>
							</Flex>
							<Button onClick={restartApp}>
								{t("settings.about.restart", "Restart Application")}
							</Button>
						</Flex>
					)}
				</Box>
			</Flex>
		</Card>
	);
