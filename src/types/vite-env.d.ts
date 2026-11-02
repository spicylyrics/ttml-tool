/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/spicylyrics/ttml-tool/blob/main/LICENSE
 */

/// <reference types="vite/client" />

declare module "virtual:i18next-loader" {
	// One entry per locale folder, e.g. { "en-US": { translation: {...} } }.
	const value: Record<
		string,
		{ translation: typeof import("../i18n/locales/en-US/translation.json") }
	>;
	export default value;
}

declare module "virtual:buildmeta" {
	export const BUILD_TIME: string;
	export const GIT_COMMIT: string;
	/** `version` from package.json, kept in sync with the desktop build. */
	export const APP_VERSION: string;
}

interface ImportMetaEnv {
	readonly TAURI_ENV_DEBUG?: string;
	readonly TAURI_ENV_TARGET_TRIPLE?: string;
	readonly TAURI_ENV_ARCH?: string;
	readonly TAURI_ENV_PLATFORM?: string;
	readonly TAURI_ENV_FAMILY?: string;
	/** Local two-origin testing of the domain migration only. */
	readonly VITE_MIGRATION_OFFICIAL_ORIGIN?: string;
	readonly VITE_MIGRATION_LEGACY_ORIGIN?: string;
	// 更多环境变量...
}

// biome-ignore lint/correctness/noUnusedVariables: 环境声明文件
interface ImportMeta {
	readonly env: ImportMetaEnv;
}
