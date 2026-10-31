import { ContextMenu } from "@radix-ui/themes";
import { type Atom, type createStore, useAtomValue, useStore } from "jotai";
import { useTranslation } from "react-i18next";
import { MENU_ACTIONS, type MenuAction } from "$/modules/menu-actions/actions";
import { formatKeyBindings } from "$/utils/keybindings";
import {
	hasSelectedWordAtom,
	openReplaceSelectedWord,
	openSplitSelectedWord,
	selectedWordTargetAtom,
} from "./word-actions";

type Store = ReturnType<typeof createStore>;

interface WordItem {
	/** Its palette action, for the label and the bound shortcut. */
	action: MenuAction;
	enabledAtom: Atom<boolean>;
	run: (store: Store) => void;
}

const WORD_ITEMS: WordItem[] = [
	{
		action: MENU_ACTIONS.splitSelectedWord,
		enabledAtom: hasSelectedWordAtom,
		run: openSplitSelectedWord,
	},
	{
		action: MENU_ACTIONS.replaceSelectedWord,
		enabledAtom: hasSelectedWordAtom,
		run: openReplaceSelectedWord,
	},
];

function WordMenuItem({ item, onLine }: { item: WordItem; onLine: boolean }) {
	const { t } = useTranslation();
	const store = useStore();
	const keys = useAtomValue(item.action.command.atom);
	const enabled = useAtomValue(item.enabledAtom);
	return (
		<ContextMenu.Item
			disabled={!(onLine && enabled)}
			onSelect={() => item.run(store)}
			shortcut={keys.length > 0 ? formatKeyBindings(keys) : undefined}
		>
			{item.action.label((key, fallback) => t(key, fallback))}
		</ContextMenu.Item>
	);
}

/**
 * Split and replace for the word selected in Time mode, in the line
 * context menu. Greyed out unless that word is on the right-clicked line.
 */
export function TimeModeWordMenuItems({ lineIndex }: { lineIndex: number }) {
	const target = useAtomValue(selectedWordTargetAtom);
	const onLine = target?.lineIndex === lineIndex;
	return (
		<>
			{WORD_ITEMS.map((item) => (
				<WordMenuItem
					key={item.action.command.id}
					item={item}
					onLine={onLine}
				/>
			))}
			<ContextMenu.Separator />
		</>
	);
}
