import type { ParseKeys } from "i18next";
import type { WritableAtom } from "jotai";
import type { RESET_KEYBINDING } from "$/utils/keybindings";

export type I18nKey = ParseKeys<"translation">;
export type KeyBindingsConfig = string[];
export type KeyBindingMode = "edit" | "sync" | "preview";

export interface KeyBindingCommand {
	/** 唯一标识符 */
	id: string;
	/** 默认快捷键组合 */
	defaultKeys: KeyBindingsConfig;
	/** 界面上显示的 i18n key */
	description: I18nKey;
	/** 设置面板中的分类 */
	category: string;
	/** Modes in which the command's handler is active (for conflict warnings). */
	modes: readonly KeyBindingMode[];
	/** This command also handles mouse bindings on a clicked timing cell. */
	supportsMouse?: boolean;
	/**
	 * 对应的 Jotai Atom
	 */
	atom: WritableAtom<
		KeyBindingsConfig,
		[update?: KeyBindingsConfig | typeof RESET_KEYBINDING | undefined],
		Promise<void>
	>;
}
