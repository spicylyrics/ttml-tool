import { DropdownMenu } from "@radix-ui/themes";
import { atom, useAtomValue, useStore } from "jotai";
import { useMemo } from "react";
import { useTranslation } from "react-i18next";
import { useTopMenuActions } from "$/components/TopMenu/useTopMenuActions";
import { useLoadAudio } from "$/hooks/useLoadAudio";
import { formatKeyBindings } from "$/utils/keybindings";
import type { MenuAction, MenuActionContext } from "./actions";

const trueAtom = atom(true);
const falseAtom = atom(false);

/** What a menu action needs to run. Mount it only where its menu or the palette is open. */
export function useMenuActionContext(): MenuActionContext {
	const store = useStore();
	const { t } = useTranslation();
	const menu = useTopMenuActions();
	const { loadAudio } = useLoadAudio();
	return useMemo(
		() => ({
			store,
			t: (key: string, fallback: string) => t(key, fallback),
			menu,
			loadAudio,
		}),
		[store, t, menu, loadAudio],
	);
}

/** A top menu item drawn from its shared definition. */
export const MenuActionItem = ({
	action,
	context,
}: {
	action: MenuAction;
	context: MenuActionContext;
}) => {
	const enabled = useAtomValue(action.enabledAtom ?? trueAtom);
	const visible = useAtomValue(action.visibleAtom ?? trueAtom);
	const checked = useAtomValue(action.checkedAtom ?? falseAtom);
	const keys = useAtomValue(action.command.atom);
	if (!visible) return null;
	const label = action.label(context.t);
	const run = () => void action.run(context);
	if (action.checkedAtom) {
		return (
			<DropdownMenu.CheckboxItem
				checked={checked}
				disabled={!enabled}
				onCheckedChange={run}
			>
				{label}
			</DropdownMenu.CheckboxItem>
		);
	}
	return (
		<DropdownMenu.Item
			disabled={!enabled}
			onSelect={run}
			shortcut={keys.length > 0 ? formatKeyBindings(keys) : undefined}
		>
			{label}
		</DropdownMenu.Item>
	);
};
