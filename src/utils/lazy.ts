import { type LazyExoticComponent, lazy as reactLazy } from "react";
import { importWithReload } from "./import-with-reload";

type LazyComponent = Awaited<
	ReturnType<Parameters<typeof reactLazy>[0]>
>["default"];

/**
 * A wrapper around React.lazy that attempts to reload the page if a dynamic import fails.
 * This is common in single-page applications when a new version is deployed and asset hashes change.
 */
export function lazy<T extends LazyComponent>(
	factory: () => Promise<{ default: T }>,
): LazyExoticComponent<T> {
	return reactLazy(() => importWithReload(factory));
}
