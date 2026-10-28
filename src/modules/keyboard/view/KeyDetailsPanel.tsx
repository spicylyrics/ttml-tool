import { Dismiss16Regular } from "@fluentui/react-icons";
import {
	Box,
	Button,
	Flex,
	Heading,
	IconButton,
	Kbd,
	Select,
	Text,
} from "@radix-ui/themes";
import { useAtomValue, useStore } from "jotai";
import { type FC, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
	getShortcutKey,
	normalizeKeyBindings,
	RESET_KEYBINDING,
	recordShortcut,
	stopRecordingShortcut,
} from "$/utils/keybindings";
import { type KeyBindingList, keyBindingListAtom } from "../binding-list";
import { findShortcutOwners } from "../conflicts";
import type { KeyBindingCommand, KeyBindingsConfig } from "../types";
import { CATEGORY_ICONS } from "./category-icons";
import styles from "./KeyboardView.module.css";
import {
	type KeyBindingRef,
	layerKey,
	refsInLayer,
	VIEW_CATEGORIES,
	viewCategoryOf,
	withBinding,
	withoutBinding,
} from "./key-index";
import { formatViewCombo } from "./labels";
import type { ModifierCode } from "./layouts";
import type { KeyboardLayoutInfo } from "./use-keyboard-layout";

type AllBindings = ReadonlyArray<{
	command: KeyBindingCommand;
	lists: KeyBindingList;
}>;

function hasShortcut(list: KeyBindingList, keys: KeyBindingsConfig, skip = -1) {
	const joined = getShortcutKey(keys);
	return list.some(
		(other, index) => index !== skip && getShortcutKey(other) === joined,
	);
}

const ActionRow: FC<{
	command: KeyBindingCommand;
	slot: number;
	layout: KeyboardLayoutInfo;
	bindings: AllBindings;
}> = ({ command, slot, layout, bindings }) => {
	const { t } = useTranslation();
	const store = useStore();
	const listAtom = keyBindingListAtom(command);
	const list = useAtomValue(listAtom);
	const [recording, setRecording] = useState(false);
	const [duplicate, setDuplicate] = useState(false);
	const recordingRef = useRef(false);
	const category = viewCategoryOf(command);
	// Closing the panel or picking another key mid-recording must not leave the
	// recorder listening, or the next press would bind to this hidden action.
	useEffect(
		() => () => {
			if (recordingRef.current) stopRecordingShortcut();
		},
		[],
	);

	const record = async (target: number | "add") => {
		if (recording) return;
		setDuplicate(false);
		setRecording(true);
		recordingRef.current = true;
		try {
			const keys = normalizeKeyBindings(await recordShortcut());
			const current = store.get(listAtom);
			if (hasShortcut(current, keys, target === "add" ? -1 : target)) {
				setDuplicate(true);
				return;
			}
			await store.set(listAtom, withBinding(current, target, keys));
		} catch {
			// Escape or another recording cancels without changing anything.
		} finally {
			recordingRef.current = false;
			setRecording(false);
		}
	};

	const owners = [
		...new Set(
			list.flatMap((keys) => findShortcutOwners(bindings, keys, command)),
		),
	];
	const bound = list.filter((keys) => keys.length > 0);
	const isDefault =
		list.length === 1 &&
		getShortcutKey(list[0]) === getShortcutKey(command.defaultKeys);

	return (
		<Box className={styles.action}>
			<Flex align="center" gap="2" mb="2">
				<span className={styles.swatch} data-category={category} aria-hidden>
					{CATEGORY_ICONS[category]}
				</span>
				<Box>
					<Text as="div" weight="medium">
						{t(command.description)}
					</Text>
					<Text as="div" size="1" color="gray">
						{t(`keyboardView.category.${category}`)}
					</Text>
				</Box>
			</Flex>
			<Flex gap="2" wrap="wrap" align="center" mb="2">
				{recording ? (
					<Text size="2" color="gray" role="status">
						{t("settingsDialog.keybindings.recording")}
					</Text>
				) : bound.length === 0 ? (
					<Text size="2" color="gray">
						{t("settingsDialog.keybindings.unbound")}
					</Text>
				) : (
					list.map((keys, index) => {
						if (keys.length === 0) return null;
						const combo = formatViewCombo(keys, layout);
						return (
							<Flex
								// biome-ignore lint/suspicious/noArrayIndexKey: slots are positional
								key={index}
								align="center"
								gap="1"
								className={styles.chip}
							>
								<Kbd size="2">{combo}</Kbd>
								{bound.length > 1 && (
									<IconButton
										size="1"
										variant="ghost"
										color="gray"
										aria-label={t("keyboardView.removeKey", { key: combo })}
										onClick={() =>
											void store.set(
												listAtom,
												withoutBinding(store.get(listAtom), index),
											)
										}
									>
										<Dismiss16Regular />
									</IconButton>
								)}
							</Flex>
						);
					})
				)}
			</Flex>
			<Flex gap="2" wrap="wrap">
				<Button
					size="1"
					variant="soft"
					disabled={recording}
					onClick={() => void record(slot)}
				>
					{t("keyboardView.changeKey")}
				</Button>
				<Button
					size="1"
					variant="soft"
					disabled={recording}
					onClick={() => void record("add")}
				>
					{t("keyboardView.addKey")}
				</Button>
				<Button
					size="1"
					variant="soft"
					color="gray"
					disabled={recording || isDefault}
					onClick={() => void store.set(listAtom, RESET_KEYBINDING)}
				>
					{t("settingsDialog.keybindings.resetDefault")}
				</Button>
			</Flex>
			{duplicate && (
				<Text as="div" size="1" color="gray" role="status" mt="2">
					{t("keyboardView.duplicateKey")}
				</Text>
			)}
			{owners.length > 0 && (
				<Text as="div" size="1" color="orange" role="status" mt="2">
					{t("settingsDialog.keybindings.conflict", {
						commands: owners.map((other) => t(other.description)).join(", "),
					})}
				</Text>
			)}
		</Box>
	);
};

const AssignAction: FC<{
	keys: KeyBindingsConfig;
	combo: string;
	bindings: AllBindings;
}> = ({ keys, combo, bindings }) => {
	const { t } = useTranslation();
	const store = useStore();
	const [commandId, setCommandId] = useState<string>();
	const command = bindings.find(
		(item) => item.command.id === commandId,
	)?.command;

	return (
		<Flex direction="column" gap="2">
			<Text size="2" color="gray">
				{t("keyboardView.freeKey", { key: combo })}
			</Text>
			<Select.Root value={commandId} onValueChange={setCommandId}>
				<Select.Trigger
					placeholder={t("keyboardView.assignPlaceholder")}
					aria-label={t("keyboardView.assignLabel")}
				/>
				<Select.Content position="popper">
					{VIEW_CATEGORIES.map((category) => (
						<Select.Group key={category}>
							<Select.Label>
								{t(`keyboardView.category.${category}`)}
							</Select.Label>
							{bindings
								.filter((item) => viewCategoryOf(item.command) === category)
								.map((item) => (
									<Select.Item key={item.command.id} value={item.command.id}>
										{t(item.command.description)}
									</Select.Item>
								))}
						</Select.Group>
					))}
				</Select.Content>
			</Select.Root>
			<Box>
				<Button
					size="1"
					variant="soft"
					disabled={!command}
					onClick={() => {
						if (!command) return;
						const listAtom = keyBindingListAtom(command);
						const current = store.get(listAtom);
						if (hasShortcut(current, keys)) return;
						void store.set(listAtom, withBinding(current, "add", keys));
					}}
				>
					{t("keyboardView.assign", { key: combo })}
				</Button>
			</Box>
		</Flex>
	);
};

export const KeyDetailsPanel: FC<{
	code: string;
	layer: ModifierCode[];
	layout: KeyboardLayoutInfo;
	refs: KeyBindingRef[];
	bindings: AllBindings;
	onClose: () => void;
}> = ({ code, layer, layout, refs, bindings, onClose }) => {
	const { t } = useTranslation();
	const keys = [...layer, code];
	const combo = formatViewCombo(keys, layout);
	const here = refsInLayer(refs, layer);
	const elsewhere = refs.filter(
		(ref) => layerKey(ref.modifiers) !== layerKey(layer),
	);

	return (
		<section className={styles.panel} aria-label={combo}>
			<Flex align="center" justify="between" gap="2" mb="3">
				<Heading as="h3" size="3">
					<Kbd size="3">{combo}</Kbd>
				</Heading>
				<IconButton
					size="1"
					variant="ghost"
					color="gray"
					aria-label={t("keyboardView.closePanel")}
					onClick={onClose}
				>
					<Dismiss16Regular />
				</IconButton>
			</Flex>
			<Flex direction="column" gap="3">
				{here.length === 0 ? (
					<AssignAction
						key={combo}
						keys={keys}
						combo={combo}
						bindings={bindings}
					/>
				) : (
					here.map((ref) => (
						<ActionRow
							key={`${ref.command.id}-${ref.slot}`}
							command={ref.command}
							slot={ref.slot}
							layout={layout}
							bindings={bindings}
						/>
					))
				)}
				{elsewhere.length > 0 && (
					<Box>
						<Text as="div" size="1" color="gray" mb="1">
							{t("keyboardView.otherLayers")}
						</Text>
						{elsewhere.map((ref) => (
							<Text as="div" size="1" key={`${ref.command.id}-${ref.slot}`}>
								{formatViewCombo(ref.binding, layout)}
								{": "}
								{t(ref.command.description)}
							</Text>
						))}
					</Box>
				)}
			</Flex>
		</section>
	);
};
