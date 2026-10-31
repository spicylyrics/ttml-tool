import { Checkmark16Regular, Search24Regular } from "@fluentui/react-icons";
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
	type ReactNode,
	useCallback,
	useEffect,
	useId,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import {
	cmdOpenCommandPalette,
	cmdOpenCommandPaletteAlternate,
} from "$/modules/keyboard/commands";
import { COMMAND_CATEGORY_ICONS } from "$/modules/keyboard/components/command-category-icons";
import { useCommand } from "$/modules/keyboard/hooks";
import { getAllCommands } from "$/modules/keyboard/registry";
import type { KeyBindingCommand } from "$/modules/keyboard/types";
import { ACTION_BY_COMMAND_ID } from "$/modules/menu-actions/all-actions";
import { settingsSearchKeywords } from "$/modules/settings/logic/settings-search";
import { getSettingsPages } from "$/modules/settings/modals/pages";
import { settingsDialogAtom, settingsTabAtom } from "$/states/dialogs.ts";
import { toolModeAtom } from "$/states/main.ts";
import {
	formatKeyBindings,
	getShortcutKey,
	shortcutKeyFromEvent,
} from "$/utils/keybindings";
import styles from "./CommandPalette.module.css";
import { commandRunsInMode, paletteListsCommand } from "./palette-commands";
import { type RankableItem, rankPaletteItems } from "./ranking";
import { runKeyboardCommand } from "./run-command";
import {
	commandPaletteOpenAtom,
	commandPaletteRecentAtom,
	pushRecent,
} from "./states";

interface PaletteItem extends RankableItem {
	kind: "command" | "setting";
	/** The shortcut group's icon for commands, the page icon for settings. */
	icon: ReactNode;
	command?: KeyBindingCommand;
	/** Listed but greyed out, like its menu item. */
	disabled?: boolean;
	/** Set for toggles. */
	checked?: boolean;
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

function eventShortcut(event: KeyboardEvent<HTMLElement>): string {
	return getShortcutKey([
		...(event.ctrlKey ? ["Control"] : []),
		...(event.metaKey ? ["Meta"] : []),
		...(event.altKey ? ["Alt"] : []),
		...(event.shiftKey ? ["Shift"] : []),
		shortcutKeyFromEvent(event),
	]);
}

export const CommandPalette = () => {
	const { t } = useTranslation();
	const [open, setOpen] = useAtom(commandPaletteOpenAtom);
	const setRecent = useSetAtom(commandPaletteRecentAtom);
	const pendingRun = useRef<(() => void) | null>(null);

	const toggle = useCallback(() => setOpen((value) => !value), [setOpen]);
	useCommand(cmdOpenCommandPalette, toggle, [toggle]);
	useCommand(cmdOpenCommandPaletteAlternate, toggle, [toggle]);

	const choose = useCallback(
		(item: PaletteItem) => {
			// Run after the dialog has closed and handed focus back, so the
			// command sees the editor rather than the search field. Recording it
			// then also keeps the list from reshuffling while it fades out.
			pendingRun.current = () => {
				setRecent((list) => pushRecent(list, item.id));
				item.run();
			};
			setOpen(false);
		},
		[setOpen, setRecent],
	);

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
				{/* Mounted only while open, so the list costs nothing the rest of the time. */}
				<PaletteSearch
					title={title}
					onChoose={choose}
					onClose={() => setOpen(false)}
				/>
			</Dialog.Content>
		</Dialog.Root>
	);
};

const PaletteSearch = ({
	title,
	onChoose,
	onClose,
}: {
	title: string;
	onChoose: (item: PaletteItem) => void;
	onClose: () => void;
}) => {
	const { t } = useTranslation();
	const store = useStore();
	const recent = useAtomValue(commandPaletteRecentAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const [query, setQuery] = useState("");
	const [activeIndex, setActiveIndex] = useState(0);
	const listId = useId();

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
		// Menu and ribbon actions are commands too; they add their control's
		// hidden, greyed and checked state. Time ribbon toggles sit in the Sync
		// group but aren't timing keys, so they stay listed in Time mode. The
		// palette is modal, so what's read here can't change while it's open.
		const commandItems = getAllCommands()
			.filter((command) => {
				const action = ACTION_BY_COMMAND_ID.get(command.id);
				if (!action) return paletteListsCommand(command, toolMode);
				if (action.paletteHidden || !commandRunsInMode(command, toolMode))
					return false;
				return action.visibleAtom ? store.get(action.visibleAtom) : true;
			})
			.map((command): PaletteItem => {
				const action = ACTION_BY_COMMAND_ID.get(command.id);
				return {
					id: `command:${command.id}`,
					kind: "command",
					icon: COMMAND_CATEGORY_ICONS[command.category],
					label: t(command.description),
					keywords: command.category,
					command,
					disabled: action?.enabledAtom
						? !store.get(action.enabledAtom)
						: false,
					checked: action?.checkedAtom
						? store.get(action.checkedAtom)
						: undefined,
					run: runCommand(command),
				};
			});
		const settingItems = getSettingsPages(t).map(
			(page): PaletteItem => ({
				id: `setting:${page.value}`,
				kind: "setting",
				icon: page.icon,
				label: page.label,
				keywords: settingsSearchKeywords[page.value] ?? "",
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
		if (!activeItem) return;
		document
			.getElementById(optionId(active))
			?.scrollIntoView({ block: "nearest" });
	});

	const choose = (item: PaletteItem | undefined) => {
		if (!item || item.disabled) return;
		onChoose(item);
	};

	const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
		if (event.nativeEvent.isComposing) return;
		const shortcut = eventShortcut(event);
		// The search field swallows global shortcuts, so close on the palette's own here.
		if (
			[cmdOpenCommandPalette, cmdOpenCommandPaletteAlternate].some(
				(command) => {
					const keys = store.get(command.atom);
					return keys.length > 0 && getShortcutKey(keys) === shortcut;
				},
			)
		) {
			event.preventDefault();
			onClose();
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

	return (
		<>
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
						aria-disabled={item.disabled || undefined}
						aria-checked={item.checked}
						className={styles.option}
						onPointerMove={() => {
							if (index !== active) setActiveIndex(index);
						}}
						onClick={() => choose(item)}
					>
						<span className={styles.icon} aria-hidden>
							{item.icon}
						</span>
						<Text size="2" className={styles.label}>
							{item.label}
						</Text>
						{item.checked && (
							<Checkmark16Regular className={styles.check} aria-hidden />
						)}
						{/* Only settings get a tag: they open a page instead of running. */}
						{item.kind === "setting" && (
							<Text size="1" color="gray" className={styles.tag}>
								{t("commandPalette.settingTag", "Preferences")}
							</Text>
						)}
						{item.command && <ShortcutKbd command={item.command} />}
					</div>
				))}
			</div>
			{results.length === 0 && (
				<Text size="2" color="gray" role="status" className={styles.empty}>
					{t("commandPalette.noResults", "No matching commands or settings")}
				</Text>
			)}
			<Flex justify="end" className={styles.footer}>
				<Text size="1" color="gray">
					{t(
						"commandPalette.hint",
						"Arrow keys to move, Enter to run, Esc to close",
					)}
				</Text>
			</Flex>
		</>
	);
};
