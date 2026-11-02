import { useStore } from "jotai";
import { type RefObject, useCallback, useRef } from "react";
import { useTranslation } from "react-i18next";
import type { useTopMenuActions } from "$/components/TopMenu/useTopMenuActions";
import { useLoadAudio } from "$/hooks/useLoadAudio";
import { useKeyBindingAtom } from "$/utils/keybindings";
import { error } from "$/utils/logging.ts";
import {
	type MenuAction,
	type MenuActionContext,
	runMenuAction,
} from "./actions";
import { ACTION_LIST } from "./all-actions";

const SHORTCUT_ACTIONS = ACTION_LIST.filter((action) => !action.boundElsewhere);

const ActionShortcut = ({
	action,
	contextRef,
}: {
	action: MenuAction;
	contextRef: RefObject<MenuActionContext>;
}) => {
	const callback = useCallback(() => {
		Promise.resolve(runMenuAction(action, contextRef.current)).catch((e) =>
			error(`Menu action "${action.command.id}" failed`, e),
		);
	}, [action, contextRef]);
	// Registers on the command's atom, so the palette can run it even unbound.
	useKeyBindingAtom(action.command.atom, callback, [callback]);
	return null;
};

/** Binds every menu and ribbon action's shortcut. Mount once, next to the top bar's own. */
export const MenuActionShortcuts = ({
	menu,
}: {
	menu: ReturnType<typeof useTopMenuActions>;
}) => {
	const store = useStore();
	const { t } = useTranslation();
	const { loadAudio } = useLoadAudio();
	const context: MenuActionContext = {
		store,
		t: (key: string, fallback: string) => t(key, fallback),
		menu,
		loadAudio,
	};
	// Read when a shortcut fires, so the bindings don't re-register on every render.
	const contextRef = useRef(context);
	contextRef.current = context;
	return SHORTCUT_ACTIONS.map((action) => (
		<ActionShortcut
			key={action.command.id}
			action={action}
			contextRef={contextRef}
		/>
	));
};
