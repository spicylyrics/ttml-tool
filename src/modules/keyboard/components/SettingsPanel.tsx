import {
	Edit20Regular,
	Folder20Regular,
	Speaker220Regular,
	Timer20Regular,
	Wand20Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Flex,
	Grid,
	Heading,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { atom, useAtom, useAtomValue } from "jotai";
import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	formatKeyBindings,
	getShortcutKey,
	RESET_KEYBINDING,
	recordShortcut,
	stopRecordingShortcut,
} from "$/utils/keybindings";
import { findKeyBindingConflicts } from "../conflicts";
import { getAllCommands } from "../registry";
import { autoSegmentDoublePressAtom } from "../states";
import type { KeyBindingCommand } from "../types";

const KEYBINDING_CATEGORY_ICONS: Record<string, React.ReactNode> = {
	File: <Folder20Regular />,
	Edit: <Edit20Regular />,
	Sync: <Timer20Regular />,
	Audio: <Speaker220Regular />,
};

const KeyBindingsEdit = ({
	command,
	conflicts = [],
}: {
	command: KeyBindingCommand;
	conflicts?: KeyBindingCommand[];
}) => {
	const { t } = useTranslation();
	const [keys, setKeys] = useAtom(command.atom);
	const [listening, setListening] = useState(false);
	const labelId = useId();
	const conflictId = useId();
	const startRecording = async () => {
		if (listening) return;
		try {
			setListening(true);
			setKeys(await recordShortcut({ allowMouse: command.supportsMouse }));
		} catch {
			// Escape or another recording cancels without changing this binding.
		} finally {
			setListening(false);
		}
	};

	return (
		<>
			<Box id={labelId} style={{ display: "flex", alignItems: "center" }}>
				{t(command.description)}
			</Box>

			<Box>
				<Flex direction="column" gap="2">
					<TextField.Root
						onClick={startRecording}
						onKeyDown={(event) => {
							if (!listening && (event.key === "Enter" || event.key === " ")) {
								event.preventDefault();
								event.stopPropagation();
								void startRecording();
							}
						}}
						aria-labelledby={labelId}
						aria-describedby={conflicts.length > 0 ? conflictId : undefined}
						size="2"
						value={
							listening
								? t("settingsDialog.keybindings.recording")
								: formatKeyBindings(keys) ||
									t("settingsDialog.keybindings.unbound")
						}
						readOnly
						variant="soft"
						style={{
							cursor: "pointer",
							textAlign: "left",
							backgroundColor: listening ? "var(--gray-3)" : "var(--gray-1)",
							color: listening ? "var(--accent-11)" : "var(--gray-12)",
						}}
					/>
					<Flex gap="2" wrap="wrap">
						<Button
							size="1"
							variant="soft"
							disabled={
								listening ||
								getShortcutKey(keys) === getShortcutKey(command.defaultKeys)
							}
							onClick={() => setKeys(RESET_KEYBINDING)}
						>
							{t("settingsDialog.keybindings.resetDefault")}
						</Button>
						<Button
							size="1"
							variant="soft"
							color="gray"
							disabled={listening || keys.length === 0}
							onClick={() => setKeys([])}
						>
							{t("settingsDialog.keybindings.clear")}
						</Button>
					</Flex>
					{conflicts.length > 0 && (
						<Text
							id={conflictId}
							as="div"
							size="1"
							color="orange"
							role="status"
						>
							{t("settingsDialog.keybindings.conflict", {
								commands: conflicts
									.map((other) => t(other.description))
									.join(", "),
							})}
						</Text>
					)}
				</Flex>
			</Box>
		</>
	);
};

export const AutoKeyBindingSettingsPanel = () => {
	const { t } = useTranslation();
	useEffect(() => () => stopRecordingShortcut(), []);
	const [autoSegmentDoublePress, setAutoSegmentDoublePress] = useAtom(
		autoSegmentDoublePressAtom,
	);
	const commands = useMemo(() => getAllCommands(), []);
	const bindingsAtom = useMemo(
		() =>
			atom((get) =>
				commands.map((command) => ({ command, keys: get(command.atom) })),
			),
		[commands],
	);
	const bindings = useAtomValue(bindingsAtom);
	const conflicts = findKeyBindingConflicts(bindings);

	const groupedCommands = commands.reduce(
		(acc, cmd) => {
			if (!acc[cmd.category]) {
				acc[cmd.category] = [];
			}
			acc[cmd.category].push(cmd);
			return acc;
		},
		{} as Record<string, KeyBindingCommand[]>,
	);

	return (
		<Box>
			{Object.entries(groupedCommands).map(([category, cmds]) => (
				<Box key={category} mb="5">
					<Heading size="3" mb="3" color="gray">
						<Flex align="center" gap="2">
							{KEYBINDING_CATEGORY_ICONS[category]}
							<span>
								{t(`settingsDialog.keybindings.category.${category}`, category)}
							</span>
						</Flex>
					</Heading>

					<Grid
						columns={{ initial: "1", sm: "2" }}
						gapX="4"
						gapY="3"
						align="center"
					>
						{cmds.map((cmd) => (
							<KeyBindingsEdit
								key={cmd.id}
								command={cmd}
								conflicts={conflicts.get(cmd.id)}
							/>
						))}
					</Grid>
				</Box>
			))}
			<Box mb="5">
				<Heading size="3" mb="3" color="gray">
					<Flex align="center" gap="2">
						<Wand20Regular />
						<span>
							{t(
								"settingsDialog.keybindings.autoSegmentOptions",
								"Auto segment",
							)}
						</span>
					</Flex>
				</Heading>
				<Flex align="center" justify="between" gap="4">
					<Box>
						<Text>
							{t(
								"settingsDialog.keybindings.autoSegmentDoublePress",
								"Require double press",
							)}
						</Text>
						<Text as="div" size="1" color="gray">
							{t(
								"settingsDialog.keybindings.autoSegmentDoublePressDesc",
								"Only run quick auto segment when you press its shortcut twice quickly.",
							)}
						</Text>
					</Box>
					<Switch
						checked={autoSegmentDoublePress}
						onCheckedChange={setAutoSegmentDoublePress}
					/>
				</Flex>
			</Box>
		</Box>
	);
};
