import { ChevronRight16Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Flex,
	Heading,
	Kbd,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { atom, useAtom, useAtomValue, useSetAtom } from "jotai";
import { useEffect, useId, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	formatKeyBindings,
	getShortcutKey,
	RESET_KEYBINDING,
	recordShortcut,
	stopRecordingShortcut,
} from "$/utils/keybindings";
import { allKeyBindingListsAtom, keyBindingListAtom } from "../binding-list";
import { findKeyBindingConflicts } from "../conflicts";
import { getAllCommands } from "../registry";
import { shortcutSearchAtom, shortcutShowAllAtom } from "../states";
import type { KeyBindingCommand } from "../types";
import { matchShortcutSearch } from "../view/key-index";
import { COMMAND_CATEGORY_ICONS } from "./command-category-icons";
import styles from "./SettingsPanel.module.css";

const KeyBindingsEdit = ({
	command,
	conflicts = [],
}: {
	command: KeyBindingCommand;
	conflicts?: KeyBindingCommand[];
}) => {
	const { t } = useTranslation();
	const [keys, setKeys] = useAtom(command.atom);
	// Clear and Reset go through the list so extra keys go with the primary.
	// Recording only replaces the primary, leaving extras alone.
	const listAtom = keyBindingListAtom(command);
	const list = useAtomValue(listAtom);
	const hasExtras = list.length > 1;
	const extras = list.slice(1).filter((extra) => extra.length > 0);
	const setList = useSetAtom(listAtom);
	const [listening, setListening] = useState(false);
	const labelId = useId();
	const conflictId = useId();
	const startRecording = async () => {
		if (listening) return;
		try {
			setListening(true);
			setKeys(await recordShortcut());
		} catch {
			// Escape or another recording cancels without changing this binding.
		} finally {
			setListening(false);
		}
	};

	return (
		<Flex className={styles.row}>
			<Text id={labelId} size="2" className={styles.name}>
				{t(command.description)}
			</Text>
			{/* Second keys are added from the keyboard above; listed here so the row is complete. */}
			{extras.map((extra, index) => (
				<Kbd
					// biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
					key={index}
					size="2"
					className={styles.extra}
				>
					{formatKeyBindings(extra)}
				</Kbd>
			))}
			<TextField.Root
				className={styles.recorder}
				data-listening={listening}
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
						: formatKeyBindings(keys) || t("settingsDialog.keybindings.unbound")
				}
				readOnly
				variant="soft"
				color="gray"
			/>
			<Button
				size="1"
				variant="soft"
				disabled={
					listening ||
					(!hasExtras &&
						getShortcutKey(keys) === getShortcutKey(command.defaultKeys))
				}
				onClick={() => void setList(RESET_KEYBINDING)}
			>
				{t("settingsDialog.keybindings.resetDefault")}
			</Button>
			<Button
				size="1"
				variant="soft"
				color="gray"
				disabled={listening || (keys.length === 0 && !hasExtras)}
				onClick={() => void setList([])}
			>
				{t("settingsDialog.keybindings.clear")}
			</Button>
			{conflicts.length > 0 && (
				<Text
					id={conflictId}
					as="div"
					size="1"
					color="orange"
					role="status"
					className={styles.conflict}
				>
					{t("settingsDialog.keybindings.conflict", {
						commands: conflicts.map((other) => t(other.description)).join(", "),
					})}
				</Text>
			)}
		</Flex>
	);
};

/**
 * "Show actions without a key", for the list below the keyboard. It sits on
 * the keyboard view's hint line instead of taking a row of its own.
 */
export const ShowAllShortcutsSwitch = () => {
	const { t } = useTranslation();
	const [showAll, setShowAll] = useAtom(shortcutShowAllAtom);
	const id = useId();
	return (
		<Flex align="center" gap="2" flexShrink="0">
			<Text as="label" htmlFor={id} size="1">
				{t("settingsDialog.keybindings.showAll")}
			</Text>
			<Switch id={id} size="1" checked={showAll} onCheckedChange={setShowAll} />
		</Flex>
	);
};

export const AutoKeyBindingSettingsPanel = () => {
	const { t } = useTranslation();
	useEffect(() => () => stopRecordingShortcut(), []);
	const commands = useMemo(() => getAllCommands(), []);
	const bindingsAtom = useMemo(
		() =>
			atom((get) =>
				commands.map((command) => ({ command, keys: get(command.atom) })),
			),
		[commands],
	);
	const bindings = useAtomValue(bindingsAtom);
	// Conflicts look at every action, not just the ones listed.
	const conflicts = findKeyBindingConflicts(bindings);
	const lists = useAtomValue(allKeyBindingListsAtom);
	const query = useAtomValue(shortcutSearchAtom);
	const showAll = useAtomValue(shortcutShowAllAtom);
	const [collapsed, setCollapsed] = useState<ReadonlySet<string>>(
		() => new Set(),
	);
	const searching = query.trim() !== "";

	// The keyboard view's search filters this list too, by name or by key, and
	// always over every action so an unbound one can be found and given a key.
	// Otherwise only actions with a key are listed unless "Show actions
	// without a key" is on.
	const matches = useMemo(
		() =>
			searching
				? matchShortcutSearch(lists, query, (command) => t(command.description))
				: undefined,
		[lists, query, searching, t],
	);
	const groups = new Map<string, KeyBindingCommand[]>();
	for (const { command, lists: keys } of lists) {
		const listed = matches
			? matches.has(command.id)
			: showAll || keys.some((binding) => binding.length > 0);
		if (!listed) continue;
		const group = groups.get(command.category) ?? [];
		group.push(command);
		groups.set(command.category, group);
	}

	return (
		<Box>
			{[...groups].map(([category, cmds]) => (
				<details
					key={category}
					className={styles.group}
					// Search results always show; otherwise each group remembers
					// being closed.
					open={searching || !collapsed.has(category)}
					onToggle={(event) => {
						if (searching) return;
						const open = event.currentTarget.open;
						setCollapsed((current) => {
							const next = new Set(current);
							if (open) next.delete(category);
							else next.add(category);
							return next;
						});
					}}
				>
					<summary className={styles.summary}>
						<span className={styles.chevron} aria-hidden>
							<ChevronRight16Regular />
						</span>
						<Heading as="h3" size="3" color="gray">
							<Flex align="center" gap="2">
								{COMMAND_CATEGORY_ICONS[category]}
								<span>
									{t(
										`settingsDialog.keybindings.category.${category}`,
										category,
									)}
								</span>
							</Flex>
						</Heading>
						<Text size="1" color="gray" className={styles.count}>
							{cmds.length}
						</Text>
					</summary>

					<div className={styles.rows}>
						{cmds.map((cmd) => (
							<KeyBindingsEdit
								key={cmd.id}
								command={cmd}
								conflicts={conflicts.get(cmd.id)}
							/>
						))}
					</div>
				</details>
			))}
			{groups.size === 0 && (
				<Text as="div" size="2" color="gray" role="status" align="center">
					{t("keyboardView.searchResults", { count: 0 })}
				</Text>
			)}
		</Box>
	);
};
