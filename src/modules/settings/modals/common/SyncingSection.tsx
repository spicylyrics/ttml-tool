import {
	ArrowEnterLeft24Regular,
	CursorClick24Regular,
	Keyboard12324Regular,
	PaddingRight24Regular,
	Timer24Regular,
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
import { DidYouKnowSetting } from "$/modules/did-you-know/DidYouKnowSetting";
import { SyncJudgeMode } from "$/modules/settings/states";
import { spectrogramHoverSyncEnabledAtom } from "$/modules/settings/states/sync";
import { KeyBindingTriggerMode } from "$/utils/keybindings";
import {
	SettingToggle,
	SyncOffsetControl,
} from "../../components/WorkflowControls";
import type { CommonSettings } from "./useCommonSettings";
export const SyncingSection = ({
	syncJudgeMode,
	setSyncJudgeMode,
	keyBindingTriggerMode,
	setKeyBindingTriggerMode,
	smartLastWord,
	setSmartLastWord,
	t,
}: Pick<
	CommonSettings,
	| "syncJudgeMode"
	| "setSyncJudgeMode"
	| "keyBindingTriggerMode"
	| "setKeyBindingTriggerMode"
	| "smartLastWord"
	| "setSmartLastWord"
	| "t"
>) => (
	<Flex direction="column" gap="3">
		<Heading size="4">{t("settings.group.timing", "Syncing")}</Heading>

		<Card>
			<Flex gap="3" align="center">
				<Timer24Regular />
				<Box flexGrow="1">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text>{t("settings.common.syncJudgeMode", "Key timing")}</Text>
							<Text size="1" color="gray">
								{t(
									"settings.common.syncJudgeModeDesc",
									"Which moment of a key press becomes the timestamp. Default: When pressed.",
								)}
							</Text>
						</Flex>

						<Select.Root
							value={syncJudgeMode}
							onValueChange={(v) => setSyncJudgeMode(v as SyncJudgeMode)}
						>
							<Select.Trigger />
							<Select.Content>
								<Select.Item value={SyncJudgeMode.FirstKeyDownTime}>
									{t(
										"settings.common.syncJudgeModeOptions.firstKeyDown",
										"When pressed",
									)}
								</Select.Item>
								<Select.Item value={SyncJudgeMode.LastKeyUpTime}>
									{t(
										"settings.common.syncJudgeModeOptions.lastKeyUp",
										"When released",
									)}
								</Select.Item>
								<Select.Item value={SyncJudgeMode.MiddleKeyTime}>
									{t(
										"settings.common.syncJudgeModeOptions.middleKey",
										"Halfway between press and release",
									)}
								</Select.Item>
								<Select.Item value={SyncJudgeMode.FirstKeyDownTimeLegacy}>
									{t(
										"settings.common.syncJudgeModeOptions.firstKeyDownLegacy",
										"When pressed (legacy)",
									)}
								</Select.Item>
							</Select.Content>
						</Select.Root>
					</Flex>
				</Box>
			</Flex>
		</Card>

		<Card>
			<Flex gap="3" align="center">
				<Keyboard12324Regular />
				<Box flexGrow="1">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text>
								{t("settings.common.keyBindingTrigger", "Run shortcuts on")}
							</Text>
							<Text size="1" color="gray">
								{t(
									"settings.common.keyBindingTriggerDesc",
									"Whether shortcuts run when a key is pressed or when it's released.",
								)}
							</Text>
						</Flex>

						<Select.Root
							value={keyBindingTriggerMode}
							onValueChange={(v) =>
								setKeyBindingTriggerMode(v as KeyBindingTriggerMode)
							}
						>
							<Select.Trigger />
							<Select.Content>
								<Select.Item value={KeyBindingTriggerMode.KeyDown}>
									{t(
										"settings.common.keyBindingTriggerOptions.keyDown",
										"Key press",
									)}
								</Select.Item>
								<Select.Item value={KeyBindingTriggerMode.KeyUp}>
									{t(
										"settings.common.keyBindingTriggerOptions.keyUp",
										"Key release",
									)}
								</Select.Item>
							</Select.Content>
						</Select.Root>
					</Flex>
				</Box>
			</Flex>
		</Card>

		<Card>
			<Flex gap="3" align="center">
				<Timer24Regular />
				<Box flexGrow="1">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text>
								{t("settings.common.syncTimeOffset", "Sync offset (ms)")}
							</Text>
							<Text size="1" color="gray">
								{t(
									"settings.common.syncTimeOffsetDesc",
									"Shifts every timestamp you record by this amount, to make up for audio or input delay.",
								)}
							</Text>
						</Flex>
						<SyncOffsetControl />
					</Flex>
				</Box>
			</Flex>
		</Card>

		<Card>
			<Flex gap="3" align="center">
				<ArrowEnterLeft24Regular />
				<Box flexGrow="1">
					<Flex align="center" justify="between" gap="4">
						<Flex direction="column" gap="1">
							<Text>
								{t("settings.common.syncCommitOffset", "Next key offset (ms)")}
							</Text>
							<Text size="1" color="gray">
								{t(
									"settings.common.syncCommitOffsetDesc",
									"Extra offset for the Next key only (G by default), for when it lands consistently early or late.",
								)}
							</Text>
						</Flex>
						<SyncOffsetControl commit />
					</Flex>
				</Box>
			</Flex>
		</Card>

		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<PaddingRight24Regular />
					<Box flexGrow="1">
						<Flex gap="2" align="center" justify="between">
							<Flex direction="column" gap="1">
								<Text>
									{t("settings.common.smartLastWord", "End-only last word")}
								</Text>
								<Text size="1" color="gray">
									{t(
										"settings.common.smartLastWordDesc",
										"On the last word of a line, the key press only sets its end time and doesn't start the next line's first word.",
									)}
								</Text>
							</Flex>
							<Switch
								checked={smartLastWord}
								onCheckedChange={setSmartLastWord}
							/>
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>

		<Card>
			<Text as="label">
				<Flex gap="3" align="center">
					<CursorClick24Regular />
					<Box flexGrow="1">
						<Flex gap="2" align="center" justify="between">
							<Flex direction="column" gap="1">
								<Text>
									{t(
										"settings.common.spectrogramHoverSync",
										"Sync at mouse position",
									)}
								</Text>
								<Text size="1" color="gray">
									{t(
										"settings.common.spectrogramHoverSyncDesc",
										"While the mouse is over the spectrogram in Time mode, the sync keys record the time under the mouse instead of the playback time.",
									)}
								</Text>
							</Flex>
							<SettingToggle setting={spectrogramHoverSyncEnabledAtom} />
						</Flex>
					</Box>
				</Flex>
			</Text>
		</Card>

		<DidYouKnowSetting />
	</Flex>
);
