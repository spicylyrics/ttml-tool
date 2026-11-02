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

import * as AMLLLyric from "@applemusic-like-lyrics/lyric";
import * as Sentry from "@sentry/react";
import { enableMapSet } from "immer";
import { Provider } from "jotai";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
// Bundled timestamp font (JetBrains Mono, SIL OFL 1.1), Latin 500 only.
import "@fontsource/jetbrains-mono/latin-500.css";
import "@fontsource-variable/geist";
import "react-toastify/dist/ReactToastify.css";

import App from "./App.tsx";
import "./i18n/index.ts";
import "./index.css";
import "./styles/spicy-lyrics-design.css";
import "./styles/lite-effects.css";
import "./utils/pwa.tsx";
import { isMigrationPath } from "$/modules/domain-migration/config";
import { MigrationRouteApp } from "$/modules/domain-migration/MigrationRouteApp";
import { globalStore } from "./states/store.ts";

async function startApp() {
	const rootEl = document.getElementById("root");

	if (!rootEl) {
		throw new Error("Could not find root element");
	}

	if (isMigrationPath(window.location.pathname)) {
		createRoot(rootEl).render(
			<StrictMode>
				<MigrationRouteApp />
			</StrictMode>,
		);
		return;
	}

	try {
		if (
			"wasm_start" in AMLLLyric &&
			typeof AMLLLyric.wasm_start === "function"
		) {
			(AMLLLyric.wasm_start as () => void)();
		}
	} catch (e) {
		console.error("Error during App initialization:", e);
	}

	enableMapSet();

	Sentry.init({
		dsn: import.meta.env.SENTRY_DSN,
		integrations: [],
	});

	createRoot(rootEl).render(
		<StrictMode>
			<Provider store={globalStore}>
				<App />
				{/* <DevTools position="bottom-right" /> */}
			</Provider>
		</StrictMode>,
	);
}

startApp();
