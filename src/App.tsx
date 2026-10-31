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

import {
	Box,
	Button,
	Flex,
	Heading,
	Text,
	TextArea,
	Theme,
} from "@radix-ui/themes";
import SuspensePlaceHolder from "$/components/SuspensePlaceHolder";
import { TouchSyncPanel } from "$/modules/lyric-editor/components/TouchSyncPanel/index.tsx";
import { log } from "$/utils/logging.ts";
// Installs second-key dispatch.
import "$/modules/keyboard/binding-list";
import "@radix-ui/themes/styles.css";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform, version } from "@tauri-apps/plugin-os";
import { useAtomValue, useSetAtom, useStore } from "jotai";
import { Tooltip as TooltipPrimitive } from "radix-ui";
import {
	Suspense,
	useEffect,
	useLayoutEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { ErrorBoundary } from "react-error-boundary";
import { useTranslation } from "react-i18next";
import { Bounce, cssTransition, ToastContainer, toast } from "react-toastify";
import semverGt from "semver/functions/gt";
import { DidYouKnowHints } from "$/modules/did-you-know/DidYouKnowHints";
import { backgroundGradients } from "$/modules/settings/states/gradients";
import {
	accentColorAtom,
	advActiveLineBgAtom,
	advAudioBarBgAtom,
	advAudioBarTextAtom,
	advancedPrimaryTextColorAtom,
	advancedSecondaryTextColorAtom,
	advancedWaveformColorAtom,
	advancedWaveformProgressColorAtom,
	advChipBorderRadiusAtom,
	advChipGapAtom,
	advChipPaddingHorizontalAtom,
	advChipPaddingVerticalAtom,
	advDialogBgAtom,
	advDialogBorderAtom,
	advEditorBgAtom,
	advGlobalBorderRadiusAtom,
	advGlobalBorderWidthAtom,
	advLineHoverBgAtom,
	advMenuHoverBgAtom,
	advRomanizationColorAtom,
	advScrollbarColorAtom,
	advSelectionColorAtom,
	advShadowIntensityAtom,
	advSidebarActiveAtom,
	advSidebarBgAtom,
	advTitlebarBgAtom,
	advTranslationColorAtom,
	appFontAtom,
	appFontStyleAtom,
	appFontWeightAtom,
	appLayoutOrderAtom,
	backgroundModeAtom,
	customAccentColorAtom,
	customFontDataAtom,
	customFontNameAtom,
	customGradientAngleAtom,
	customGradientCenterAtom,
	customGradientColorsAtom,
	customGradientOpacityAtom,
	customGradientSizeAtom,
	customGradientTypeAtom,
	DEFAULT_APP_FONT,
	glassmorphismBlurAtom,
	legacyDarkThemeAtom,
	liteEffectsAtom,
	SPICY_LYRICS_FONT_STACK,
	selectedGradientAtom,
	spicyLyricsDesignAtom,
	useCustomAccentAtom,
	useCustomGradientAtom,
} from "$/modules/settings/states/index.ts";
import { lazy } from "$/utils/lazy.ts";
import styles from "./App.module.css";
import DarkThemeDetector from "./components/DarkThemeDetector";
import { ResizablePanel } from "./components/ResizablePanel";
import RibbonBar from "./components/RibbonBar";
import { TitleBar } from "./components/TitleBar";
import { useFileOpener } from "./hooks/useFileOpener.ts";
import AudioControls from "./modules/audio/components/index.tsx";
import { useAudioFeedback } from "./modules/audio/hooks/useAudioFeedback.ts";
import { DiscordPresence } from "./modules/discord-presence/DiscordPresence";
import { MigrationNotice } from "./modules/domain-migration/MigrationNotice";
import { LogoColorStyle } from "./modules/logo-color/LogoColorStyle";
import { SyncKeyBinding } from "./modules/lyric-editor/components/sync-keybinding.tsx";
import { UrbanDictionaryKeybinding } from "./modules/lyric-editor/components/urban-dictionary-keybinding.tsx";
import { BeginnerGuide } from "./modules/onboarding/BeginnerGuide";
import { AudioMetadataPrefill } from "./modules/project/audio-metadata";
import { AutosaveManager } from "./modules/project/autosave/AutosaveManager.tsx";
import { GlobalDragOverlay } from "./modules/project/modals/GlobalDragOverlay.tsx";
import { type ExportTranslation, saveTTML } from "./modules/project/ttml-save";
import { InterfaceScaleManager } from "./modules/settings/components/InterfaceScaleManager";
import {
	customBackgroundBlurAtom,
	customBackgroundBrightnessAtom,
	customBackgroundImageAtom,
	customBackgroundImageInitAtom,
	customBackgroundMaskAtom,
	customBackgroundOpacityAtom,
} from "./modules/settings/modals/customBackground";
import { showTouchSyncPanelAtom } from "./modules/settings/states/sync.ts";
import { UpdatedToast } from "./modules/updated-toast/UpdatedToast";
import { settingsDialogAtom, settingsTabAtom } from "./states/dialogs.ts";
import {
	isDarkThemeAtom,
	isGlobalFileDraggingAtom,
	lyricLinesAtom,
	showPreviewPanelAtom,
	ToolMode,
	toolModeAtom,
} from "./states/main.ts";
import { generateGradient, generateRadixScale } from "./utils/colorScale.ts";
import { attachDroppedFilePath } from "./utils/droppedFilePath.ts";
import { useAppUpdate } from "./utils/useAppUpdate.ts";

const LyricLinesView = lazy(() => import("./modules/lyric-editor/components"));
const PreviewModeSwitcher = lazy(
	() => import("./components/PreviewModeSwitcher"),
);
const Dialogs = lazy(() => import("./components/Dialogs"));

const editorModeViewStyle = {
	height: "100%",
	maxHeight: "100%",
	overflowY: "hidden",
} as const;

// The default toast bounce overshoots; the design slides in and out instead.
const spicyLyricsToastTransition = cssTransition({
	enter: "sl-toast-enter",
	exit: "sl-toast-exit",
});

const AppErrorPage = ({
	error,
	resetErrorBoundary,
}: {
	error: unknown;
	resetErrorBoundary: () => void;
}) => {
	const store = useStore();
	const { t } = useTranslation();
	const [exportWarning, setExportWarning] = useState("");
	const exportT: ExportTranslation = (key, fallback, options) =>
		t(key, fallback ?? key, options);

	return (
		<Flex direction="column" align="center" justify="center" height="100vh">
			<Flex direction="column" align="start" justify="center" gap="2">
				<Heading>{t("app.error.title", "Something went wrong")}</Heading>
				<Text>
					{t("app.error.description", "TTML Tool ran into an error.")}
				</Text>
				<Text>
					{t("app.error.checkDevTools", "Details are in the developer tools.")}
				</Text>
				<Flex gap="2">
					<Button
						onClick={() => {
							setExportWarning("");
							void saveTTML(store, exportT, {
								recovery: true,
								onWarning: (message) =>
									setExportWarning((previous) =>
										previous ? `${previous} ${message}` : message,
									),
							});
						}}
					>
						{t("app.error.saveLyrics", "Try saving your lyrics")}
					</Button>
					<Button
						onClick={() => {
							resetErrorBoundary();
						}}
						variant="soft"
					>
						{t("app.error.tryRestart", "尝试重新进入程序")}
					</Button>
				</Flex>
				{exportWarning && <Text role="status">{exportWarning}</Text>}
				<Text>{t("app.error.details", "Error details:")}</Text>
				<TextArea
					readOnly
					value={String(error)}
					style={{
						width: "100%",
						height: "8em",
					}}
				/>
			</Flex>
		</Flex>
	);
};

function App() {
	const isDarkTheme = useAtomValue(isDarkThemeAtom);
	const legacyDarkTheme = useAtomValue(legacyDarkThemeAtom);
	const spicyLyricsDesign = useAtomValue(spicyLyricsDesignAtom);
	const liteEffects = useAtomValue(liteEffectsAtom);
	const toolMode = useAtomValue(toolModeAtom);
	const showTouchSyncPanel = useAtomValue(showTouchSyncPanelAtom);
	const showPreviewPanel = useAtomValue(showPreviewPanelAtom);
	// Preview mode already owns the entire editor area. Keep the sync preview
	// pane's setting intact for when the user returns, but never render a second
	// preview beside it.
	const previewPanelVisible = showPreviewPanel && toolMode !== ToolMode.Preview;
	const customBackgroundImage = useAtomValue(customBackgroundImageAtom);
	const customBackgroundOpacity = useAtomValue(customBackgroundOpacityAtom);
	const customBackgroundMask = useAtomValue(customBackgroundMaskAtom);
	const customBackgroundBlur = useAtomValue(customBackgroundBlurAtom);
	const customBackgroundBrightness = useAtomValue(
		customBackgroundBrightnessAtom,
	);
	const accentColor = useAtomValue(accentColorAtom);
	const useCustomAccent = useAtomValue(useCustomAccentAtom);
	const customAccentColor = useAtomValue(customAccentColorAtom);

	const useCustomGradient = useAtomValue(useCustomGradientAtom);
	const customGradientColors = useAtomValue(customGradientColorsAtom);
	const customGradientType = useAtomValue(customGradientTypeAtom);
	const customGradientOpacity = useAtomValue(customGradientOpacityAtom);
	const customGradientCenter = useAtomValue(customGradientCenterAtom);
	const customGradientAngle = useAtomValue(customGradientAngleAtom);
	const customGradientSize = useAtomValue(customGradientSizeAtom);
	const appFont = useAtomValue(appFontAtom);
	const appFontWeight = useAtomValue(appFontWeightAtom);
	const appFontStyle = useAtomValue(appFontStyleAtom);
	const customFontData = useAtomValue(customFontDataAtom);
	const customFontName = useAtomValue(customFontNameAtom);
	const glassmorphismBlur = useAtomValue(glassmorphismBlurAtom);
	const advPrimaryText = useAtomValue(advancedPrimaryTextColorAtom);
	const advSecondaryText = useAtomValue(advancedSecondaryTextColorAtom);
	const advWaveformColor = useAtomValue(advancedWaveformColorAtom);
	const advWaveformProgress = useAtomValue(advancedWaveformProgressColorAtom);

	const vTitlebarBg = useAtomValue(advTitlebarBgAtom);
	const vSidebarBg = useAtomValue(advSidebarBgAtom);
	const vSidebarActive = useAtomValue(advSidebarActiveAtom);
	const vMenuHover = useAtomValue(advMenuHoverBgAtom);
	const vEditorBg = useAtomValue(advEditorBgAtom);
	const vActiveLine = useAtomValue(advActiveLineBgAtom);
	const vLineHover = useAtomValue(advLineHoverBgAtom);
	const vChipRadius = useAtomValue(advChipBorderRadiusAtom);
	const vChipGap = useAtomValue(advChipGapAtom);
	const vChipPaddingV = useAtomValue(advChipPaddingVerticalAtom);
	const vChipPaddingH = useAtomValue(advChipPaddingHorizontalAtom);
	const vRomanColor = useAtomValue(advRomanizationColorAtom);
	const vTransColor = useAtomValue(advTranslationColorAtom);
	const vAudioBarBg = useAtomValue(advAudioBarBgAtom);
	const vAudioBarText = useAtomValue(advAudioBarTextAtom);
	const vScrollbar = useAtomValue(advScrollbarColorAtom);
	const vDialogBg = useAtomValue(advDialogBgAtom);
	const vDialogBorder = useAtomValue(advDialogBorderAtom);
	const vGlobalRadius = useAtomValue(advGlobalBorderRadiusAtom);
	const vGlobalBorderWidth = useAtomValue(advGlobalBorderWidthAtom);
	const vShadow = useAtomValue(advShadowIntensityAtom);
	const vSelection = useAtomValue(advSelectionColorAtom);
	const appLayoutOrder = useAtomValue(appLayoutOrderAtom);
	useEffect(() => {
		// Extract font name from appFont string (e.g., '"Inter", sans-serif' -> 'Inter')
		const match = appFont.match(/"([^"]+)"/);
		if (match) {
			const fontName = match[1];
			// Only load if it's not the custom font and not a system default
			if (
				fontName !== customFontName &&
				!["MiSans", "Inter", "system-ui"].includes(fontName)
			) {
				const fontId = `google-font-${fontName.replace(/\s+/g, "-")}`;
				if (!document.getElementById(fontId)) {
					const link = document.createElement("link");
					link.id = fontId;
					link.rel = "stylesheet";
					// Load Regular(400), Bold(700) and their Italic versions
					link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, "+")}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
					document.head.appendChild(link);
				}
			}
		}
	}, [appFont, customFontName]);

	const backgroundMode = useAtomValue(backgroundModeAtom);
	const selectedGradientId = useAtomValue(selectedGradientAtom);
	const selectedGradient = backgroundGradients.find(
		(g) => g.id === selectedGradientId,
	);

	const [hasBackground, setHasBackground] = useState(false);
	// The Spicy Lyrics design is dark-only; the OS theme applies with it off.
	const effectiveTheme = spicyLyricsDesign || isDarkTheme ? "dark" : "light";

	// On <html> rather than the Theme root, so Radix's portalled menus and
	// dialogs pick the design up too.
	useLayoutEffect(() => {
		const root = document.documentElement.dataset;
		if (!spicyLyricsDesign) {
			delete root.design;
			delete root.designAccent;
			delete root.designBackdrop;
			return;
		}
		root.design = "spicy-lyrics";
		if (useCustomAccent) delete root.designAccent;
		else root.designAccent = "brand";
		if (hasBackground) root.designBackdrop = "";
		else delete root.designBackdrop;
	}, [spicyLyricsDesign, useCustomAccent, hasBackground]);

	// Read by src/styles/lite-effects.css, with the design on or off.
	useLayoutEffect(() => {
		const root = document.documentElement.dataset;
		if (liteEffects) root.effects = "lite";
		else delete root.effects;
	}, [liteEffects]);

	const customThemeStyles = useCustomAccent
		? generateRadixScale(customAccentColor, effectiveTheme === "dark")
		: null;
	const uiFont =
		spicyLyricsDesign && appFont === DEFAULT_APP_FONT
			? SPICY_LYRICS_FONT_STACK
			: appFont;
	// Solid panels under the design unless the user picked a backdrop to see
	// through. Lite effects always go solid: Radix blurs behind every card.
	const solidPanels = liteEffects || (spicyLyricsDesign && !hasBackground);
	const panelBackdrop = solidPanels
		? "none"
		: `blur(${glassmorphismBlur}px) saturate(160%)`;

	const customStyleString = useMemo(() => {
		let vars = "";
		if (customThemeStyles) {
			vars += Object.entries(customThemeStyles)
				.map(([k, v]) => `${k}: ${v} !important;`)
				.join("\n\t\t");
		}

		let customFontFace = "";
		if (customFontData && customFontName) {
			customFontFace = `
			@font-face {
				font-family: "${customFontName}";
				src: url("${customFontData}");
				font-weight: normal;
				font-style: normal;
			}
			`;
		}

		return `
		${customFontFace}
		:root {
			--default-font-family: ${uiFont} !important;
			--preview-font-family: ${appFont};
			--glass-blur: ${glassmorphismBlur}px !important;
			--backdrop-blur: ${glassmorphismBlur}px !important;
			--custom-backdrop-blur: ${glassmorphismBlur}px !important;
		}
		.radix-themes,
		.radix-themes:is(.dark, .dark-theme),
		.radix-themes:is(.light, .light-theme),
		.radix-themes:is(.dark, .dark-theme):not([data-legacy-dark-theme="true"]) {
			--default-font-family: ${uiFont} !important;
			--glass-blur: ${glassmorphismBlur}px !important;
			--backdrop-blur: ${glassmorphismBlur}px !important;
			--backdrop-filter-panel: ${panelBackdrop} !important;
			--custom-backdrop-blur: ${glassmorphismBlur}px !important;
			${advPrimaryText ? `--gray-12: ${advPrimaryText} !important;` : ""}
			${advSecondaryText ? `--gray-11: ${advSecondaryText} !important;` : ""}
			${advWaveformColor ? `--adv-waveform-color: ${advWaveformColor} !important;` : ""}
			${advWaveformProgress ? `--adv-waveform-progress: ${advWaveformProgress} !important;` : ""}
			
			${vTitlebarBg ? `--titlebar-bg: ${vTitlebarBg} !important;` : ""}
			${vSidebarBg ? `--sidebar-bg: ${vSidebarBg} !important;` : ""}
			${vSidebarActive ? `--sidebar-active: ${vSidebarActive} !important;` : ""}
			${vMenuHover ? `--menu-hover: ${vMenuHover} !important;` : ""}
			${vEditorBg ? `--editor-bg: ${vEditorBg} !important;` : ""}
			${vActiveLine ? `--active-line-bg: ${vActiveLine} !important;` : ""}
			${vLineHover ? `--line-hover-bg: ${vLineHover} !important;` : ""}
			${vSelection ? `--selection-color: ${vSelection} !important;` : ""}
			
			--chip-radius: ${vChipRadius}px !important;
			--chip-gap: ${vChipGap}px !important;
			--chip-padding-v: ${vChipPaddingV}px !important;
			--chip-padding-h: ${vChipPaddingH}px !important;
			
			${vRomanColor ? `--romanization-color: ${vRomanColor} !important;` : ""}
			${vTransColor ? `--translation-color: ${vTransColor} !important;` : ""}
			
			${vAudioBarBg ? `--audio-bar-bg: ${vAudioBarBg} !important;` : ""}
			${vAudioBarText ? `--audio-bar-text: ${vAudioBarText} !important;` : ""}
			
			${vScrollbar ? `--scrollbar-thumb-color: ${vScrollbar} !important;` : ""}
			${vDialogBg ? `--dialog-bg: ${vDialogBg} !important;` : ""}
			${vDialogBorder ? `--dialog-border: ${vDialogBorder} !important;` : ""}
			
			--global-radius: ${vGlobalRadius}px !important;
			--global-border-width: ${vGlobalBorderWidth}px !important;
			--shadow-intensity: ${vShadow} !important;
			--custom-backdrop-blur: ${glassmorphismBlur}px !important;

			--radius-factor: ${vGlobalRadius / 12} !important;

			/* Comprehensive Overrides */
			${vTitlebarBg ? `--color-panel-translucent: ${vTitlebarBg} !important;` : ""}
			${vEditorBg ? `--color-background: ${vEditorBg} !important;` : ""}
			${vSelection ? `--accent-a5: ${vSelection} !important;` : ""}
			${vDialogBg ? `--rt-color-panel-solid: ${vDialogBg} !important;` : ""}
			
			/* Shadow Scaling */
			--shadow-intensity: ${vShadow};
			--rt-shadow-color: rgba(0, 0, 0, calc(0.1 * var(--shadow-intensity)));
			--shadow-1: 0 1px 2px var(--rt-shadow-color);
			--shadow-2: 0 3px 6px var(--rt-shadow-color);
			--shadow-3: 0 10px 20px var(--rt-shadow-color);
			--shadow-4: 0 15px 30px var(--rt-shadow-color);
			--shadow-5: 0 20px 40px var(--rt-shadow-color);
			--shadow-6: 0 25px 50px var(--rt-shadow-color);

			/* Sidebar & Global Navigation */
			${vSidebarBg ? `--sidebar-bg: ${vSidebarBg} !important;` : ""}
			${vSidebarActive ? `--sidebar-active: ${vSidebarActive} !important;` : ""}
			${vMenuHover ? `--rt-menu-item-hover-bg: ${vMenuHover} !important;` : ""}
			${vMenuHover ? `--menu-hover: ${vMenuHover} !important;` : ""}

			font-family: var(--default-font-family);
			font-weight: ${appFontWeight} !important;
			font-style: ${appFontStyle} !important;
			${vars}
		}
		`;
	}, [
		customThemeStyles,
		appFont,
		uiFont,
		panelBackdrop,
		glassmorphismBlur,
		advPrimaryText,
		advSecondaryText,
		advWaveformColor,
		advWaveformProgress,
		vTitlebarBg,
		vSidebarBg,
		vSidebarActive,
		vMenuHover,
		vEditorBg,
		vActiveLine,
		vLineHover,
		vChipRadius,
		vChipGap,
		vChipPaddingV,
		vChipPaddingH,
		vRomanColor,
		vTransColor,
		vAudioBarBg,
		vAudioBarText,
		vScrollbar,
		vDialogBg,
		vDialogBorder,
		vGlobalRadius,
		vGlobalBorderWidth,
		vShadow,
		vSelection,
		appFontWeight,
		appFontStyle,
		customFontData,
		customFontName,
	]);

	useEffect(() => {
		setHasBackground(
			backgroundMode !== "none" &&
				!!(customBackgroundImage || selectedGradient || useCustomGradient),
		);
	}, [
		backgroundMode,
		customBackgroundImage,
		selectedGradient,
		useCustomGradient,
	]);
	const { checkUpdate, status, update } = useAppUpdate();
	const hasNotifiedRef = useRef(false);
	const setSettingsOpen = useSetAtom(settingsDialogAtom);
	const setSettingsTab = useSetAtom(settingsTabAtom);
	const initCustomBackgroundImage = useSetAtom(customBackgroundImageInitAtom);
	const { t } = useTranslation();
	const store = useStore();

	useEffect(() => {
		initCustomBackgroundImage();
	}, [initCustomBackgroundImage]);

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) return;
		// Flatpak and package-manager installs on Linux update elsewhere.
		invoke<boolean>("can_self_update").then((supported) => {
			if (supported) checkUpdate(true);
		});
	}, [checkUpdate]);

	useEffect(() => {
		if (status === "available" && update && !hasNotifiedRef.current) {
			hasNotifiedRef.current = true;

			toast.info(
				<div>
					<div style={{ fontWeight: "bold" }}>
						{t("app.update.updateAvailable", "发现新版本: {version}", {
							version: update.version,
						})}
					</div>
				</div>,
				{
					autoClose: 5000,
					onClick: () => {
						setSettingsTab("about");
						setSettingsOpen(true);
					},
				},
			);
		}
	}, [status, update, t, setSettingsOpen, setSettingsTab]);

	const setIsGlobalDragging = useSetAtom(isGlobalFileDraggingAtom);
	const { openFile, openFiles } = useFileOpener();
	useAudioFeedback();

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) {
			return;
		}

		(async () => {
			const file: {
				filename: string;
				data: string;
				ext: string;
			} | null = await invoke("get_open_file_data");

			if (file) {
				log("File data from tauri args", file);

				const fileObj = new File([file.data], file.filename, {
					type: "text/plain",
				});

				openFile(fileObj);
			}
		})();
	}, [openFile]);

	useEffect(() => {
		if (!import.meta.env.TAURI_ENV_PLATFORM) {
			return;
		}

		(async () => {
			const win = getCurrentWindow();
			if (platform() === "windows") {
				if (semverGt("10.0.22000", version())) {
					setHasBackground(true);
					await win.clearEffects();
				}
			}

			await new Promise((r) => setTimeout(r, 50));

			await win.show();
		})();
	}, []);

	useEffect(() => {
		// Dev reloads constantly; the "unsaved changes" prompt only gets in the way.
		if (import.meta.env.DEV) return;
		const onBeforeClose = (evt: BeforeUnloadEvent) => {
			const currentLyricLines = store.get(lyricLinesAtom);
			if (
				currentLyricLines.lyricLines.length +
					currentLyricLines.metadata.length >
				0
			) {
				evt.preventDefault();
				evt.returnValue = false;
			}
		};
		window.addEventListener("beforeunload", onBeforeClose);
		return () => {
			window.removeEventListener("beforeunload", onBeforeClose);
		};
	}, [store]);

	useEffect(() => {
		const handleDragEnter = (e: DragEvent) => {
			if (e.dataTransfer?.types.includes("Files")) {
				setIsGlobalDragging(true);
			}
		};

		const handleDragOver = (e: DragEvent) => {
			e.preventDefault();
		};

		const handleDragLeave = (e: DragEvent) => {
			if (e.relatedTarget === null) {
				setIsGlobalDragging(false);
			}
		};

		const handleDrop = (e: DragEvent) => {
			e.preventDefault();
			setIsGlobalDragging(false);

			// A lyric file and an audio file dropped together both open.
			const files = Array.from(e.dataTransfer?.files ?? []);
			if (files.length > 0)
				void Promise.allSettled(files.map(attachDroppedFilePath)).then(() =>
					openFiles(files),
				);
		};

		window.addEventListener("dragenter", handleDragEnter);
		window.addEventListener("dragover", handleDragOver);
		window.addEventListener("dragleave", handleDragLeave);
		window.addEventListener("drop", handleDrop);

		return () => {
			window.removeEventListener("dragenter", handleDragEnter);
			window.removeEventListener("dragover", handleDragOver);
			window.removeEventListener("dragleave", handleDragLeave);
			window.removeEventListener("drop", handleDrop);
		};
	}, [setIsGlobalDragging, openFiles]);

	return (
		<Theme
			appearance={effectiveTheme}
			// Ignored under the design. Stamping it would also weaken the selector
			// that lets the user's Advanced overrides beat the design.
			data-legacy-dark-theme={
				(!spicyLyricsDesign && legacyDarkTheme) || undefined
			}
			panelBackground={liteEffects ? "solid" : "translucent"}
			hasBackground={hasBackground}
			accentColor={accentColor}
			className={styles.radixTheme}
		>
			{/* Same delay as the Theme's own provider, but a tooltip closes once the
			    pointer leaves its control instead of staying up while hovered. */}
			<TooltipPrimitive.Provider delayDuration={200} disableHoverableContent>
				{import.meta.env.TAURI_ENV_PLATFORM && <InterfaceScaleManager />}
				<MigrationNotice />
				<DiscordPresence />
				<BeginnerGuide />
				<DidYouKnowHints />
				<AudioMetadataPrefill />
				{customStyleString ? <style>{customStyleString}</style> : null}
				<ErrorBoundary
					FallbackComponent={AppErrorPage}
					onReset={(_details) => {
						// TODO
					}}
				>
					{hasBackground && (
						<div className={styles.customBackgroundLayer} aria-hidden="true">
							<div
								className={styles.customBackgroundImage}
								style={{
									backgroundImage:
										backgroundMode === "image"
											? `url(${customBackgroundImage})`
											: backgroundMode === "gradient"
												? useCustomGradient
													? generateGradient(
															customGradientColors,
															customGradientType,
															customGradientCenter,
															customGradientAngle,
															customGradientSize,
														)
													: selectedGradient?.css
												: undefined,
									opacity:
										backgroundMode === "gradient"
											? customGradientOpacity
											: customBackgroundOpacity,
									filter: `blur(${customBackgroundBlur}px) brightness(${customBackgroundBrightness})`,
								}}
							/>
							<div
								className={styles.customBackgroundMask}
								style={{
									opacity:
										backgroundMode === "gradient" ? 0 : customBackgroundMask,
								}}
							/>
						</div>
					)}
					<div className={styles.appContent}>
						<AutosaveManager />
						<GlobalDragOverlay />
						{toolMode === ToolMode.Sync && <SyncKeyBinding />}
						<UrbanDictionaryKeybinding />
						<DarkThemeDetector />
						<LogoColorStyle />
						<Flex direction="column" height="100vh">
							{appLayoutOrder.map((id) => {
								if (id === "titlebar") return <TitleBar key="titlebar" />;
								if (id === "ribbonbar") return <RibbonBar key="ribbonbar" />;
								if (id === "editor") {
									const editorContent = (
										<Box flexGrow="1" overflow="hidden" key="editor-content">
											<Flex height="100%" overflow="hidden">
												<Box flexGrow="1" minWidth="0" overflow="hidden">
													{previewPanelVisible ? (
														<Flex height="100%" gap="2" p="2">
															<Box flexGrow="1" overflow="hidden">
																<SuspensePlaceHolder key={toolMode}>
																	<div style={editorModeViewStyle}>
																		<LyricLinesView key={toolMode} />
																	</div>
																</SuspensePlaceHolder>
															</Box>
															<ResizablePanel>
																<SuspensePlaceHolder key="preview-panel">
																	<div style={{ height: "100%" }}>
																		<PreviewModeSwitcher />
																	</div>
																</SuspensePlaceHolder>
															</ResizablePanel>
														</Flex>
													) : toolMode !== ToolMode.Preview ? (
														// Mode switches swap instantly: fading the editor
														// out and in left a blank panel and flickered.
														<SuspensePlaceHolder key={toolMode}>
															<div style={editorModeViewStyle}>
																<LyricLinesView key={toolMode} />
															</div>
														</SuspensePlaceHolder>
													) : (
														<SuspensePlaceHolder key="preview-switcher">
															<Box height="100%" p="2">
																<PreviewModeSwitcher />
															</Box>
														</SuspensePlaceHolder>
													)}
												</Box>
											</Flex>
										</Box>
									);

									return editorContent;
								}
								if (id === "audio-controls") {
									return (
										<Box flexShrink="0" key="audio-controls">
											<AudioControls />
										</Box>
									);
								}
								return null;
							})}
							{showTouchSyncPanel && toolMode === ToolMode.Sync && (
								<TouchSyncPanel />
							)}
						</Flex>
						<Suspense fallback={null}>
							<Dialogs />
						</Suspense>
						<ToastContainer
							theme={effectiveTheme}
							transition={
								spicyLyricsDesign ? spicyLyricsToastTransition : Bounce
							}
						/>
						<UpdatedToast />
					</div>
				</ErrorBoundary>
			</TooltipPrimitive.Provider>
		</Theme>
	);
}

export default App;
