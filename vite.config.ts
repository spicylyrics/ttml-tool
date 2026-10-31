import { exec } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import jotaiDebugLabel from "jotai/babel/plugin-debug-label";
import jotaiReactRefresh from "jotai/babel/plugin-react-refresh";
import ConditionalCompile from "unplugin-preprocessor-directives/vite";
import { defineConfig, type Plugin } from "vite";
import i18nextLoader from "vite-plugin-i18next-loader";
import wasm from "vite-plugin-wasm";
import svgLoader from "vite-svg-loader";
import { configDefaults } from "vitest/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

const AMLL_LOCAL_PATH = resolve(
	__dirname,
	"./applemusic-like-lyrics-main/applemusic-like-lyrics-main",
);
const AMLL_LOCAL_EXISTS = existsSync(AMLL_LOCAL_PATH);

process.env.AMLL_LOCAL_EXISTS = AMLL_LOCAL_EXISTS ? "true" : "false";

const localePaths: string[] = [resolve(__dirname, "./src/i18n/locales")];

const plugins: Plugin[] = [
	ConditionalCompile(),
	react({
		babel: {
			presets: ["jotai/babel/preset"],
			plugins: [jotaiDebugLabel, jotaiReactRefresh],
		},
	}),
	svgLoader(),
	wasm(),
	i18nextLoader({
		paths: localePaths,
		namespaceResolution: "basename",
	}),
	{
		name: "buildmeta",
		async resolveId(id) {
			if (id === "virtual:buildmeta") {
				return id;
			}
		},
		async load(id) {
			if (id === "virtual:buildmeta") {
				let gitCommit = (
					process.env.WORKERS_CI_COMMIT_SHA ?? process.env.VERCEL_GIT_COMMIT_SHA
				)?.trim();

				if (!gitCommit) {
					try {
						gitCommit = await new Promise<string>((resolve, reject) =>
							exec("git rev-parse HEAD", (err, stdout) => {
								if (err) {
									reject(err);
								} else {
									resolve(stdout.trim());
								}
							}),
						);
					} catch {}
				}

				const appVersion: string =
					JSON.parse(readFileSync(resolve(__dirname, "package.json"), "utf8"))
						.version ?? "";

				return `
					export const BUILD_TIME = ${JSON.stringify(new Date().toISOString())};
					export const GIT_COMMIT = ${JSON.stringify(gitCommit ?? "unknown")};
					export const APP_VERSION = ${JSON.stringify(appVersion)};
				`;
			}
		},
	},
];

export default defineConfig({
	plugins: [
		{
			name: "shim-module",
			transform(code, id) {
				if (
					id.includes("node_modules/hangul-romanize") ||
					id.includes("node_modules/pinyin-pro") ||
					id.includes("node_modules/wanakana")
				) {
					return {
						code: `var module = { exports: {} };\n${code}`,
						map: null,
					};
				}
			},
		},
		...plugins,
	],
	base: process.env.TAURI_ENV_PLATFORM ? "/" : "./",
	clearScreen: false,
	optimizeDeps: {
		include: ["jotai"],
		exclude: ["url", "hangul-romanize"],
	},
	server: {
		watch: {
			ignored: ["**/src-tauri/target/**"],
		},
		headers: {
			"Cross-Origin-Embedder-Policy": "require-corp",
			"Cross-Origin-Opener-Policy": "same-origin",
		},
		strictPort: true,
	},
	envPrefix: ["VITE_", "TAURI_", "AMLL_", "SENTRY_"],
	build: {
		target:
			process.env.TAURI_ENV_PLATFORM === "windows" ? "chrome105" : "safari15",
		minify: !process.env.TAURI_ENV_DEBUG ? "esbuild" : false,
		sourcemap: true,
	},
	resolve: {
		alias: Object.assign<Record<string, string>, Record<string, string>>(
			{
				$: resolve(__dirname, "src"),
				url: resolve(__dirname, "src/utils/url-shim.ts"),
			},
			AMLL_LOCAL_EXISTS
				? {
						"@applemusic-like-lyrics/core": resolve(
							AMLL_LOCAL_PATH,
							"packages/core/src",
						),
						"@applemusic-like-lyrics/react": resolve(
							AMLL_LOCAL_PATH,
							"packages/react/src",
						),
						"@applemusic-like-lyrics/lyric": resolve(
							AMLL_LOCAL_PATH,
							"packages/lyric/src",
						),
						"@applemusic-like-lyrics/ttml": resolve(
							AMLL_LOCAL_PATH,
							"packages/ttml/src",
						),
					}
				: {},
		),
		dedupe: ["react", "react-dom"],
	},
	worker: {
		format: "es",
	},
	define: {
		global: "globalThis",
	},
	test: {
		// The lyric parsers only declare a "module" entry, which the test
		// resolver skips; point it at the file so modules importing them can
		// be mocked in tests.
		alias: {
			"@applemusic-like-lyrics/lyric": resolve(
				__dirname,
				"node_modules/@applemusic-like-lyrics/lyric/pkg/amll_lyric.js",
			),
		},
		exclude: [
			...configDefaults.exclude,
			"scripts/version-utils.test.mjs",
			"scripts/generate-contributors.test.mjs",
			"scripts/check-locales.test.mjs",
			// Session worktrees are full checkouts of the repo.
			".claude/**",
		],
	},
});
