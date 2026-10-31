import { Search16Regular } from "@fluentui/react-icons";
import { Box, Flex, Text, TextField, Tooltip } from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import {
	type CSSProperties,
	type FC,
	useEffect,
	useMemo,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { OptionPicker } from "$/components/OptionPicker";
import { stopRecordingShortcut } from "$/utils/keybindings";
import { allKeyBindingListsAtom } from "../binding-list";
import { ShowAllShortcutsSwitch } from "../components/SettingsPanel";
import { shortcutSearchAtom } from "../states";
import type { KeyBindingCommand } from "../types";
import { CATEGORY_ICONS } from "./category-icons";
import styles from "./KeyboardView.module.css";
import { KeyDetailsPanel } from "./KeyDetailsPanel";
import {
	buildKeyIndex,
	type KeyBindingRef,
	matchShortcutSearch,
	refsInLayer,
	VIEW_CATEGORIES,
	viewCategoryOf,
} from "./key-index";
import {
	capFaceLabel,
	capLabel,
	capShortcutKey,
	formatViewCombo,
} from "./labels";
import {
	geometryFor,
	isGap,
	isModifierCode,
	type KeyCap,
	type KeyRowItem,
	type ModifierCode,
	mainRows,
	NAVIGATION_ROWS,
} from "./layouts";
import {
	type KeyboardLayoutChoice,
	type KeyboardLayoutInfo,
	keyboardViewLayoutAtom,
	useKeyboardLayout,
} from "./use-keyboard-layout";

const LAYOUT_NAMES = { qwerty: "QWERTY", azerty: "AZERTY", qwertz: "QWERTZ" };

interface CapContext {
	index: Map<string, KeyBindingRef[]>;
	layer: ModifierCode[];
	layout: KeyboardLayoutInfo;
	selected?: string;
	/** Undefined while not searching. */
	matches?: Set<string>;
	nameOf: (command: KeyBindingCommand) => string;
	onSelect: (code: string) => void;
	onToggleModifier: (code: ModifierCode) => void;
}

const Cap: FC<{ cap: KeyCap; context: CapContext }> = ({ cap, context }) => {
	const { t } = useTranslation();
	const { code } = cap;
	const label = capLabel(code, context.layout);
	const face = capFaceLabel(code, context.layout);
	const shortcutKey = capShortcutKey(code, context.layout);
	const style = { "--w": cap.width ?? 1 } as CSSProperties;

	if (isModifierCode(code)) {
		const pressed = context.layer.includes(code);
		return (
			<button
				type="button"
				className={styles.cap}
				style={style}
				data-code={code}
				data-modifier=""
				aria-pressed={pressed}
				aria-label={t("keyboardView.modifierLayer", { key: label })}
				onClick={() => context.onToggleModifier(code)}
			>
				<span className={styles.capLabel}>{face}</span>
			</button>
		);
	}

	const allRefs = context.index.get(shortcutKey) ?? [];
	const refs = refsInLayer(allRefs, context.layer);
	const category = refs[0] ? viewCategoryOf(refs[0].command) : undefined;
	const names = refs.map((ref) => context.nameOf(ref.command));
	const match = context.matches
		? allRefs.some((ref) => context.matches?.has(ref.command.id))
		: undefined;

	const button = (
		<button
			type="button"
			className={styles.cap}
			style={style}
			data-code={code}
			data-category={category}
			data-selected={context.selected === shortcutKey || undefined}
			data-match={match === undefined ? undefined : String(match)}
			aria-hidden={cap.continuation || undefined}
			tabIndex={cap.continuation ? -1 : undefined}
			aria-label={
				names.length > 0
					? t("keyboardView.keyActions", {
							key: label,
							actions: names.join(", "),
						})
					: t("keyboardView.keyFree", { key: label })
			}
			onClick={() => context.onSelect(shortcutKey)}
		>
			<span className={styles.capLabel}>{cap.continuation ? "" : face}</span>
			{category && !cap.continuation && (
				<span className={styles.capIcon} aria-hidden>
					{CATEGORY_ICONS[category]}
				</span>
			)}
		</button>
	);
	if (cap.continuation) return button;

	return (
		<Tooltip
			side="top"
			maxWidth="320px"
			content={
				// Tooltip content renders inside a <p>, so only inline elements here.
				<Flex as="span" direction="column" gap="1">
					{allRefs.length === 0 ? (
						<Text as="span">{t("keyboardView.free")}</Text>
					) : (
						allRefs.map((ref) => (
							<Flex
								as="span"
								key={`${ref.command.id}-${ref.slot}`}
								direction="column"
							>
								<Text as="span" weight="medium">
									{formatViewCombo(ref.binding, context.layout)}
									{": "}
									{context.nameOf(ref.command)}
								</Text>
								<Text as="span" size="1">
									{t(
										`keyboardView.category.${viewCategoryOf(ref.command)}` as const,
									)}
								</Text>
							</Flex>
						))
					)}
				</Flex>
			}
		>
			{button}
		</Tooltip>
	);
};

const Row: FC<{ items: KeyRowItem[]; context: CapContext }> = ({
	items,
	context,
}) => (
	<div className={styles.row}>
		{items.map((item, index) =>
			isGap(item) ? (
				<span
					// biome-ignore lint/suspicious/noArrayIndexKey: static layout rows
					key={`gap-${index}`}
					className={styles.gap}
					style={{ "--w": item.gap } as CSSProperties}
				/>
			) : (
				<Cap
					// The same code can appear twice in a row (Shift, Alt, Control).
					key={`${item.code}-${index}`}
					cap={item}
					context={context}
				/>
			),
		)}
	</div>
);

export const KeyboardView: FC = () => {
	const { t } = useTranslation();
	const bindings = useAtomValue(allKeyBindingListsAtom);
	const layout = useKeyboardLayout();
	const [layoutChoice, setLayoutChoice] = useAtom(keyboardViewLayoutAtom);
	const [layer, setLayer] = useState<ModifierCode[]>([]);
	const [selected, setSelected] = useState<string>();
	// Shared with the list below, which this search filters too.
	const [query, setQuery] = useAtom(shortcutSearchAtom);
	useEffect(() => () => stopRecordingShortcut(), []);
	// Leaving Shortcuts clears the search, so it doesn't come back filtered.
	useEffect(() => () => setQuery(""), [setQuery]);

	const index = useMemo(() => buildKeyIndex(bindings), [bindings]);
	const nameOf = (command: KeyBindingCommand) => t(command.description);
	const matches = query.trim()
		? matchShortcutSearch(bindings, query, nameOf)
		: undefined;

	const context: CapContext = {
		index,
		layer,
		layout,
		selected,
		matches,
		nameOf,
		onSelect: (code) =>
			setSelected((current) => (current === code ? undefined : code)),
		onToggleModifier: (code) =>
			setLayer((current) =>
				current.includes(code)
					? current.filter((held) => held !== code)
					: [...current, code],
			),
	};

	const autoDescription = layout.detected
		? t("keyboardView.layoutDetected", {
				layout: LAYOUT_NAMES[layout.detected],
			})
		: layout.canDetect
			? undefined
			: t("keyboardView.layoutUnavailable");

	return (
		<Box className={styles.root}>
			<Flex gap="3" wrap="wrap" align="center" mb="3">
				<Box className={styles.search}>
					<TextField.Root
						size="2"
						value={query}
						onChange={(event) => setQuery(event.currentTarget.value)}
						placeholder={t("keyboardView.search")}
						aria-label={t("keyboardView.search")}
					>
						<TextField.Slot>
							<Search16Regular />
						</TextField.Slot>
					</TextField.Root>
				</Box>
				<OptionPicker<KeyboardLayoutChoice>
					label={t("keyboardView.layout")}
					value={layoutChoice}
					onValueChange={setLayoutChoice}
					size="2"
					options={[
						{
							value: "auto",
							label: t("keyboardView.layoutAuto"),
							description: autoDescription,
						},
						{ value: "qwerty", label: "QWERTY" },
						{ value: "azerty", label: "AZERTY" },
						{ value: "qwertz", label: "QWERTZ" },
					]}
				/>
			</Flex>
			{matches && (
				<Text as="div" size="1" color="gray" role="status" mb="2">
					{t("keyboardView.searchResults", { count: matches.size })}
				</Text>
			)}
			<div className={styles.layout}>
				<Box>
					<div
						className={styles.board}
						role="group"
						aria-label={t("keyboardView.title")}
					>
						<div className={styles.block}>
							{mainRows(geometryFor(layout.layout)).map((items, rowIndex) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static layout rows
								<Row key={rowIndex} items={items} context={context} />
							))}
						</div>
						<div className={styles.block}>
							{NAVIGATION_ROWS.map((items, rowIndex) => (
								// biome-ignore lint/suspicious/noArrayIndexKey: static layout rows
								<Row key={rowIndex} items={items} context={context} />
							))}
						</div>
					</div>
					<Flex gap="4" wrap="wrap" mt="3" align="center">
						{VIEW_CATEGORIES.map((category) => (
							<Flex key={category} gap="2" align="center">
								<span
									className={styles.swatch}
									data-category={category}
									aria-hidden
								>
									{CATEGORY_ICONS[category]}
								</span>
								<Text size="1">{t(`keyboardView.category.${category}`)}</Text>
							</Flex>
						))}
					</Flex>
					<Flex align="center" justify="between" gap="4" mt="2" wrap="wrap">
						<Text as="p" size="1" color="gray">
							{t("keyboardView.layerHint")}
						</Text>
						<ShowAllShortcutsSwitch />
					</Flex>
				</Box>
				{selected && (
					<KeyDetailsPanel
						code={selected}
						layer={layer}
						layout={layout}
						refs={index.get(selected) ?? []}
						bindings={bindings}
						onClose={() => setSelected(undefined)}
					/>
				)}
			</div>
		</Box>
	);
};
