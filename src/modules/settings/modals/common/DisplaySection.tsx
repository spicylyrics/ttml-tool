import {
	LocalLanguage24Regular,
	VideoBackgroundEffect24Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Card,
	Flex,
	Heading,
	Select,
	Switch,
	Text,
} from "@radix-ui/themes";
import resources from "$/i18n/resources";
import { getLanguageName, getTranslationProgress } from "./language";
import type { CommonSettings } from "./useCommonSettings";
export const DisplaySection = ({
	languageOptions,
	compactBGInSync,
	setCompactBGInSync,
	t,
	i18n,
	currentLanguage,
}: Pick<
	CommonSettings,
	| "languageOptions"
	| "compactBGInSync"
	| "setCompactBGInSync"
	| "t"
	| "i18n"
	| "currentLanguage"
>) => (
	<Flex direction="column" gap="2">
		<Heading size="4">{t("settings.group.display", "Display")}</Heading>

		<Card>
			<Flex gap="3" align="center">
				<LocalLanguage24Regular />
				<Box flexGrow="1">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text>{t("settings.common.language", "Interface language")}</Text>
							<Text size="1" color="gray">
								{t(
									"settings.common.languageDesc",
									"Select the language for the interface",
								)}
							</Text>
						</Flex>

						<Flex direction="column" gap="2" align="end">
							<Select.Root
								value={currentLanguage}
								onValueChange={(lng) => {
									i18n.changeLanguage(lng).then(() => {
										localStorage.setItem("language", lng);
									});
								}}
							>
								<Select.Trigger />
								<Select.Content>
									{languageOptions.map((code) => {
										const progress = getTranslationProgress(code, resources);
										return (
											<Select.Item key={code} value={code}>
												<Flex
													justify="between"
													gap="4"
													align="center"
													style={{ width: "100%" }}
												>
													<Text>{getLanguageName(code)}</Text>
													{code === "en-US" ? (
														<Text size="1" color="gray">
															(Source)
														</Text>
													) : (
														progress !== null && (
															<Text
																size="1"
																color={progress === 100 ? "green" : "gray"}
															>
																{progress}%
															</Text>
														)
													)}
												</Flex>
											</Select.Item>
										);
									})}
								</Select.Content>
							</Select.Root>
						</Flex>
					</Flex>
				</Box>
			</Flex>
		</Card>

		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<VideoBackgroundEffect24Regular />
					<Box flexGrow="1">
						<Flex gap="2" align="center" justify="between">
							<Flex direction="column" gap="1">
								<Text>
									{t(
										"settings.common.compactBGInSync",
										"Compact background lines in Time mode",
									)}
								</Text>
								<Text size="1" color="gray">
									{t(
										"settings.common.compactBGInSyncDesc",
										"Use less vertical space for background lines while syncing.",
									)}
								</Text>
							</Flex>
							<Switch
								checked={compactBGInSync}
								onCheckedChange={setCompactBGInSync}
							/>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>
	</Flex>
);
