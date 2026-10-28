import { useAtomValue } from "jotai";
import { type DependencyList, useEffect } from "react";
import {
	type KeyBindingCallback,
	registerExtraKeyBindings,
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

	useKeyBinding(enabled ? currentKeys : [], callback, deps);
	useEffect(() => {
		if (!enabled) return;
		return registerExtraKeyBindings(currentKeys, extraKeys, callback);
	}, [currentKeys, extraKeys, callback, enabled, ...deps]);
}
