import { MENU_ACTIONS, type MenuAction } from "./actions";
import { RIBBON_ACTIONS } from "./ribbon-actions";
import { SECTION_ACTIONS } from "./section-actions";

/** Every menu, ribbon and section action, in Shortcuts page order. */
export const ACTION_LIST: readonly MenuAction[] = [
	...Object.values(MENU_ACTIONS),
	...Object.values(SECTION_ACTIONS),
	...Object.values(RIBBON_ACTIONS),
];

/** Actions by their command id, for the palette's hidden, greyed and checked state. */
export const ACTION_BY_COMMAND_ID: ReadonlyMap<string, MenuAction> = new Map(
	ACTION_LIST.map((action) => [action.command.id, action]),
);
