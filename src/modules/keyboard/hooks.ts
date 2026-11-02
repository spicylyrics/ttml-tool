import { useAtomValue } from "jotai";
import { type DependencyList, useEffect } from "react";
import {
	type KeyBindingCallback,
	registerExtraKeyBindings,
	registerKeyBindingAtom,
	useDoublePress,
	useExtraKeyBindings,
	useKeyBinding,
} from "$/utils/keybindings";
import type { KeyBindingCommand } from "./types";

// biome-ignore lint/correctness/noUnusedVariables: JSDoc
type Commands = typeof import("./commands");

/**
 * 在组件中绑定快捷键命令
 * @param command 注册好的命令对象，参见 {@link Commands commands.ts}
 * @param callback 触发时的回调函数
 * @param deps 依赖项数组 (同 useEffect)
 */
export function useCommand(
	command: KeyBindingCommand,
	callback: KeyBindingCallback,
	deps: DependencyList = [],
	enabled = true,
) {
	const currentKeys = useAtomValue(command.atom);
	const extraKeys = useExtraKeyBindings(command.atom);
	const doublePress = useDoublePress(command.atom);

	// One press as usual. "Press twice to run" swaps in the double-press
	// listener and registers on the atom too, so the command palette, which
	// would otherwise press the shortcut once, can still run it.
	useKeyBinding(enabled && !doublePress ? currentKeys : [], callback, deps);
	useEffect(() => {
		if (!enabled || !doublePress) return;
		return registerKeyBindingAtom(command.atom, currentKeys, callback, true);
	}, [command.atom, currentKeys, callback, enabled, doublePress, ...deps]);
	useEffect(() => {
		if (!enabled) return;
		return registerExtraKeyBindings(
			currentKeys,
			extraKeys,
			callback,
			doublePress,
		);
	}, [currentKeys, extraKeys, callback, enabled, doublePress, ...deps]);
}
