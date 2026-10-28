import { Search24Regular } from "@fluentui/react-icons";
import {
	Dialog,
	Flex,
	Kbd,
	Text,
	TextField,
	VisuallyHidden,
} from "@radix-ui/themes";
import { useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import {
	type KeyboardEvent,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { useCommand } from "$/modules/keyboard/hooks";
import { getAllCommands } from "$/modules/keyboard/registry";
import type { KeyBindingCommand } from "$/modules/keyboard/types";
import { settingsSearchKeywords } from "$/modules/settings/logic/settings-search";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs.ts";
import { toolModeAtom } from "$/states/main.ts";
import {
	formatKeyBindings,
	getShortcutKey,
	normalizeKeyCode,
} from "$/utils/keybindings";
import styles from "./CommandPalette.module.css";
import {
	commandRunsInMode,
	getPaletteCommands,
	PALETTE_COMMAND_IDS,
} from "./palette-commands";
import { type RankableItem, rankPaletteItems } from "./ranking";
import { runKeyboardCommand } from "./run-command";
import {
	commandPaletteEnabledAtom,
	commandPaletteOpenAtom,
	commandPaletteRecentAtom,
	pushRecent,
} from "./states";

interface PaletteItem extends RankableItem {
	kind: "command" | "setting";
	command?: KeyBindingCommand;
	run: () => void;
}

/** The command's current shortcut, live, so a rebind shows up without reopening. */
const ShortcutKbd = ({ command }: { command: KeyBindingCommand }) => {
	const keys = useAtomValue(command.atom);
	if (keys.length === 0) return null;
	return (
		<Kbd size="1" className={styles.shortcut}>
			{formatKeyBindings(keys)}
		</Kbd>
	);
};

/** Mounted only while the flag is on, so nothing below binds keys when it's off. */
export const CommandPalette = () => {
	const enabled = useAtomValue(commandPaletteEnabledAtom);
	return enabled ? <CommandPaletteDialog /> : null;
};

function eventShortcut(event: KeyboardEvent<HTMLElement>): string {
	return getShortcutKey([
		...(event.ctrlKey ? ["Control"] : []),
		...(event.metaKey ? ["Meta"] : []),
		...(event.altKey ? ["Alt"] : []),
		...(event.shiftKey ? ["Shift"] : []),
		normalizeKeyCode(event.code),
	]);
}

const CommandPaletteDialog = () => {
	const { t } = useTranslation();
	const store = useStore();
	const [open, setOpen] = useAtom(commandPaletteOpenAtom);
	const [recent, setRecent] = useAtom(commandPaletteRecentAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const pendingRun = useRef<(() => void) | null>(null);
	const listId = useId();

	const paletteCommands = useMemo(() => getPaletteCommands(), []);
	const toggle = useCallback(() => setOpen((value) => !value), [setOpen]);
	useCommand(paletteCommands.open, toggle, [toggle]);
	useCommand(paletteCommands.openAlternate, toggle, [toggle]);

	useEffect(() => {
		if (!open) return;
		setQuery("");
		setActiveIndex(0);
	}, [open]);

	const items = useMemo<PaletteItem[]>(() => {
		const runCommand = (command: KeyBindingCommand) => () => {
			if (!runKeyboardCommand(store, command)) {
				toast.info(
					t(
						"commandPalette.notRunnable",
						"Couldn't run this command. Give it a shortcut in Preferences, then try again.",
					),
				);
			}
		};
		const commandItems = getAllCommands()
			.filter(
				(command) =>
					!PALETTE_COMMAND_IDS.has(command.id) &&
					commandRunsInMode(command, toolMode),
			)
			.map(
				(command): PaletteItem => ({
					id: `command:${command.id}`,
					kind: "command",
					label: t(command.description),
					keywords: command.category,
					command,
					run: runCommand(command),
				}),
			);
		const settingsPages = [
			{
				value: "common",
				label: t("settingsDialog.tab.common", "General"),
				description: t("settingsDialog.page.generalDesc"),
			},
			{
				value: "editor",
				label: t("settingsDialog.tab.editor", "Editor & sync"),
				description: t("settingsDialog.page.editorDesc"),
			},
			{
				value: "files",
				label: t("settingsDialog.tab.files", "Files & storage"),
				description: t("settingsDialog.page.filesDesc"),
			},
			{
				value: "audio",
				label: t("settingsDialog.tab.audio", "Audio"),
				description: t("settingsDialog.page.audioDesc"),
			},
			{
				value: "keybinding",
				label: t("settingsDialog.tab.keybindings", "Shortcuts"),
				description: "",
			},
			{
				value: "appearance",
				label: t("settingsDialog.tab.appearance", "Appearance"),
				description: "",
			},
			{ value: "about", label: t("common.about", "About"), description: "" },
		];
		const settingItems = settingsPages.map(
			(page): PaletteItem => ({
				id: `setting:${page.value}`,
				kind: "setting",
				label: page.label,
				keywords: `${page.description} ${settingsSearchKeywords[page.value] ?? ""}`,
				run: () => {
					setSettingsTab(page.value);
					setSettingsOpen(true);
				},
			}),
		);
		return [...commandItems, ...settingItems];
	}, [store, t, toolMode, setSettingsOpen, setSettingsTab]);

	const results = useMemo(
		() => rankPaletteItems(items, query, recent),
		[items, query, recent],
	);
	const active = Math.min(activeIndex, Math.max(results.length - 1, 0));
	const activeItem = results[active];
	const optionId = (index: number) => `${listId}-option-${index}`;

	useEffect(() => {
		if (!open || !activeItem) return;
		document
			.getElementById(optionId(active))
			?.scrollIntoView({ block: "nearest" });
	});

	const choose = (item: PaletteItem | undefined) => {
		if (!item) return;
		// Run after the dialog has closed and handed focus back, so the
		// command sees the editor rather than the search field. Recording it
		// then also keeps the list from reshuffling while it fades out.
		pendingRun.current = () => {
			setRecent((list) => pushRecent(list, item.id));
			item.run();
		};
		setOpen(false);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) return;
		const shortcut = eventShortcut(event);
		// The search field swallows global shortcuts, so close on the palette's own here.
		if (
			[paletteCommands.open, paletteCommands.openAlternate].some((command) => {
				const keys = store.get(command.atom);
				return keys.length > 0 && getShortcutKey(keys) === shortcut;
			})
		) {
			event.preventDefault();
			setOpen(false);
			return;
		}
		const last = results.length - 1;
		switch (event.key) {
			case "ArrowDown":
				event.preventDefault();
				setActiveIndex(active >= last ? 0 : active + 1);
				break;
			case "ArrowUp":
				event.preventDefault();
				setActiveIndex(active <= 0 ? last : active - 1);
				break;
			case "PageDown":
				event.preventDefault();
				setActiveIndex(Math.min(active + 8, last));
				break;
			case "PageUp":
				event.preventDefault();
				setActiveIndex(Math.max(active - 8, 0));
				break;
			case "Enter":
				event.preventDefault();
				choose(activeItem);
				break;
		}
	};

	const title = t("commandPalette.title", "Command palette");

	return (
		<Dialog.Root open={open} onOpenChange={setOpen}>
			<Dialog.Content
				maxWidth="560px"
				align="start"
				className={styles.content}
				aria-describedby={undefined}
				onCloseAutoFocus={() => {
					const run = pendingRun.current;
					pendingRun.current = null;
					if (run) requestAnimationFrame(run);
				}}
			>
				<VisuallyHidden>
					<Dialog.Title>{title}</Dialog.Title>
				</VisuallyHidden>
				<TextField.Root
					size="3"
					value={query}
					onChange={(event) => {
						setQuery(event.target.value);
						setActiveIndex(0);
					}}
					onKeyDown={onKeyDown}
					placeholder={t(
						"commandPalette.placeholder",
						"Search commands and settings",
					)}
					aria-label={title}
					role="combobox"
					aria-expanded
					aria-controls={listId}
					aria-autocomplete="list"
					aria-activedescendant={activeItem ? optionId(active) : undefined}
					autoComplete="off"
					spellCheck={false}
				>
					<TextField.Slot>
						<Search24Regular width="18" height="18" />
					</TextField.Slot>
				</TextField.Root>
				<div
					id={listId}
					role="listbox"
					aria-label={title}
					className={styles.list}
				>
					{/* Keyboard is handled on the search field (aria-activedescendant). */}
					{results.map((item, index) => (
						<div
							key={item.id}
							id={optionId(index)}
							role="option"
							tabIndex={-1}
							aria-selected={index === active}
							className={styles.option}
							onPointerMove={() => {
								if (index !== active) setActiveIndex(index);
							}}
							onClick={() => choose(item)}
						>
							<Text size="2" className={styles.label}>
								{item.label}
							</Text>
							<Text size="1" color="gray" className={styles.tag}>
								{item.kind === "command"
									? t("commandPalette.commandTag", "Command")
									: t("commandPalette.settingTag", "Preferences")}
							</Text>
							{item.command && <ShortcutKbd command={item.command} />}
						</div>
					))}
				</div>
				{results.length === 0 && (
					<Text size="2" color="gray" role="status" className={styles.empty}>
						{t("commandPalette.noResults", "No matching commands or settings")}
					</Text>
				)}
				<Flex justify="end" pt="2">
					<Text size="1" color="gray">
						{t(
							"commandPalette.hint",
							"Arrow keys to move, Enter to run, Esc to close",
						)}
					</Text>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
