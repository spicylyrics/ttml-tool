import { t } from "./i18n-helper";
import { registerCommand } from "./registry";

const IS_MAC = navigator.userAgent.includes("Mac");
const CONTROL_KEY = IS_MAC ? "Meta" : "Control";
const DELETE_KEY = IS_MAC ? "Backspace" : "Delete";

// =========================================================================================
//  文件操作
// =========================================================================================

export const cmdNewFile = registerCommand(
	"newFile",
	[CONTROL_KEY, "KeyN"],
	t("settingsDialog.keybindings.newFile"),
	"File",
);

export const cmdOpenFile = registerCommand(
	"openFile",
	[CONTROL_KEY, "KeyO"],
	t("settingsDialog.keybindings.openFile"),
	"File",
);

export const cmdSaveFile = registerCommand(
	"saveFile",
	[CONTROL_KEY, "KeyS"],
	t("settingsDialog.keybindings.saveFile"),
	"File",
);

// =========================================================================================
//  编辑与选择
// =========================================================================================

export const cmdUndo = registerCommand(
	"undo",
	[CONTROL_KEY, "KeyZ"],
	t("settingsDialog.keybindings.undo"),
	"Edit",
);

export const cmdRedo = registerCommand(
	"redo",
	[CONTROL_KEY, "Shift", "KeyZ"],
	t("settingsDialog.keybindings.redo"),
	"Edit",
);

export const cmdRedoAlternate = registerCommand(
	"redoAlternate",
	[CONTROL_KEY, "KeyY"],
	t("settingsDialog.keybindings.redoAlternate"),
	"Edit",
);

export const cmdSelectAll = registerCommand(
	"selectAll",
	[CONTROL_KEY, "KeyA"],
	t("settingsDialog.keybindings.selectAll"),
	"Edit",
);

export const cmdUnselectAll = registerCommand(
	"unselectAll",
	[CONTROL_KEY, "Escape"],
	t("settingsDialog.keybindings.unselectAll"),
	"Edit",
);

// Edit as text mounts their handlers and opens with its search ready.
export const cmdFindInLyrics = registerCommand(
	"findInLyrics",
	[CONTROL_KEY, "KeyF"],
	t("settingsDialog.keybindings.findInLyrics"),
	"Edit",
);

// Cmd+H hides the app on macOS.
export const cmdReplaceInLyrics = registerCommand(
	"replaceInLyrics",
	IS_MAC ? [CONTROL_KEY, "Alt", "KeyF"] : [CONTROL_KEY, "KeyH"],
	t("settingsDialog.keybindings.replaceInLyrics"),
	"Edit",
);

export const cmdDeleteSelection = registerCommand(
	"deleteSelection",
	[DELETE_KEY],
	t("settingsDialog.keybindings.deleteSelection"),
	"Edit",
);

export const cmdAutoSegment = registerCommand(
	"autoSegment",
	["KeyE"],
	t("settingsDialog.keybindings.autoSegment"),
	"Edit",
);

export const cmdAutoSegmentDialog = registerCommand(
	"autoSegmentDialog",
	["Shift", "KeyE"],
	t("settingsDialog.keybindings.autoSegmentDialog"),
	"Edit",
);

// =========================================================================================
//  视图模式
// =========================================================================================

export const cmdSwitchEditMode = registerCommand(
	"switchEditMode",
	["Shift", "Digit1"],
	t("settingsDialog.keybindings.switchEditMode"),
	"View",
);

export const cmdSwitchSyncMode = registerCommand(
	"switchSyncMode",
	["Shift", "Digit2"],
	t("settingsDialog.keybindings.switchSyncMode"),
	"View",
);

export const cmdSwitchPreviewMode = registerCommand(
	"switchPreviewMode",
	["Shift", "Digit3"],
	t("settingsDialog.keybindings.switchPreviewMode"),
	"View",
);

export const cmdLocateActiveLine = registerCommand(
	"locateActiveLine",
	[CONTROL_KEY, "Shift", "KeyL"],
	t("settingsDialog.keybindings.locateActiveLine"),
	"View",
);

export const cmdInterfaceScaleUp = registerCommand(
	"interfaceScaleUp",
	[CONTROL_KEY, "Equal"],
	t("settingsDialog.keybindings.interfaceScaleUp"),
	"View",
);

export const cmdInterfaceScaleUpAlternate = registerCommand(
	"interfaceScaleUpAlternate",
	[CONTROL_KEY, "Shift", "Equal"],
	t("settingsDialog.keybindings.interfaceScaleUpAlternate"),
	"View",
);

export const cmdInterfaceScaleDown = registerCommand(
	"interfaceScaleDown",
	[CONTROL_KEY, "Minus"],
	t("settingsDialog.keybindings.interfaceScaleDown"),
	"View",
);

export const cmdInterfaceScaleReset = registerCommand(
	"interfaceScaleReset",
	[CONTROL_KEY, "Digit0"],
	t("settingsDialog.keybindings.interfaceScaleReset"),
	"View",
);

// The command palette mounts their handlers.
export const cmdOpenCommandPalette = registerCommand(
	"openCommandPalette",
	[CONTROL_KEY, "KeyK"],
	t("commandPalette.shortcut"),
	"View",
);

export const cmdOpenCommandPaletteAlternate = registerCommand(
	"openCommandPaletteAlternate",
	[CONTROL_KEY, "Shift", "KeyP"],
	t("commandPalette.shortcutAlternate"),
	"View",
);

// =========================================================================================
//  打轴操作
// =========================================================================================

export const cmdMoveNextWord = registerCommand(
	"moveNextWord",
	["KeyD"],
	t("settingsDialog.keybindings.moveNextWord"),
	"Sync",
);

export const cmdMovePrevWord = registerCommand(
	"movePrevWord",
	["KeyA"],
	t("settingsDialog.keybindings.movePrevWord"),
	"Sync",
);

export const cmdMoveNextLine = registerCommand(
	"moveNextLine",
	["KeyS"],
	t("settingsDialog.keybindings.moveNextLine"),
	"Sync",
);

export const cmdMovePrevLine = registerCommand(
	"movePrevLine",
	["KeyW"],
	t("settingsDialog.keybindings.movePrevLine"),
	"Sync",
);

export const cmdMovePrevWordAndPlay = registerCommand(
	"movePrevWordAndPlay",
	["KeyR"],
	t("settingsDialog.keybindings.movePrevWordAndPlay"),
	"Sync",
);

export const cmdMoveNextWordAndPlay = registerCommand(
	"moveNextWordAndPlay",
	["KeyY"],
	t("settingsDialog.keybindings.moveNextWordAndPlay"),
	"Sync",
);

export const cmdSyncStart = registerCommand(
	"syncStart",
	["KeyF"],
	t("settingsDialog.keybindings.syncStart"),
	"Sync",
);

export const cmdSyncNext = registerCommand(
	"syncNext",
	["KeyG"],
	t("settingsDialog.keybindings.syncNext"),
	"Sync",
);

export const cmdSyncEnd = registerCommand(
	"syncEnd",
	["KeyH"],
	t("settingsDialog.keybindings.syncEnd"),
	"Sync",
);

export const cmdToggleWordHighlight = registerCommand(
	"toggleWordHighlight",
	["KeyK"],
	t("settingsDialog.keybindings.toggleWordHighlight"),
	"Sync",
);

export const cmdUrbanDictionary = registerCommand(
	"urbanDictionary",
	["Shift", "KeyF"],
	t("settingsDialog.keybindings.urbanDictionary"),
	"Edit",
	["edit"],
);

export const cmdUrbanDictionarySync = registerCommand(
	"urbanDictionarySync",
	["Shift", "KeyF"],
	t("settingsDialog.keybindings.urbanDictionarySync"),
	"Sync",
);

export const cmdMoveFirstWordAndPlay = registerCommand(
	"moveFirstWordAndPlay",
	["Home"],
	t("settingsDialog.keybindings.moveFirstWordAndPlay"),
	"Sync",
);

export const cmdMoveLastWordAndPlay = registerCommand(
	"moveLastWordAndPlay",
	["End"],
	t("settingsDialog.keybindings.moveLastWordAndPlay"),
	"Sync",
);

// =========================================================================================
//  音频控制
// =========================================================================================

export const cmdPlayPause = registerCommand(
	"playPause",
	["Space"],
	t("settingsDialog.keybindings.playPause"),
	"Audio",
);

export const cmdSeekForward = registerCommand(
	"seekForward",
	["ArrowRight"],
	t("settingsDialog.keybindings.seekForward"),
	"Audio",
);

export const cmdSeekBackward = registerCommand(
	"seekBackward",
	["ArrowLeft"],
	t("settingsDialog.keybindings.seekBackward"),
	"Audio",
);

export const cmdVolumeUp = registerCommand(
	"volumeUp",
	["ArrowUp"],
	t("settingsDialog.keybindings.volumeUp"),
	"Audio",
);

export const cmdVolumeDown = registerCommand(
	"volumeDown",
	["ArrowDown"],
	t("settingsDialog.keybindings.volumeDown"),
	"Audio",
);

export const cmdPlaybackRateUp = registerCommand(
	"playbackRateUp",
	["BracketRight"],
	t("settingsDialog.keybindings.playbackRateUp"),
	"Audio",
);

export const cmdPlaybackRateDown = registerCommand(
	"playbackRateDown",
	["BracketLeft"],
	t("settingsDialog.keybindings.playbackRateDown"),
	"Audio",
);

export const cmdPlaybackRateReset = registerCommand(
	"playbackRateReset",
	["Quote"],
	t("settingsDialog.keybindings.playbackRateReset"),
	"Audio",
);

export const cmdDuplicatePaste = registerCommand(
	"duplicatePaste",
	[CONTROL_KEY, "KeyL"],
	t("settingsDialog.keybindings.duplicatePaste"),
	"Edit",
);

// =========================================================================================
//  频谱图/试听
// =========================================================================================

export const cmdAuditionSelectionBefore = registerCommand(
	"auditionSelectionBefore",
	["KeyQ"],
	t("settingsDialog.keybindings.auditionSelectionBefore"),
	"Spectrogram",
);

export const cmdAuditionSelection = registerCommand(
	"auditionSelection",
	["KeyB"],
	t("settingsDialog.keybindings.auditionSelection"),
	"Spectrogram",
);

export const cmdAuditionSelectionAfter = registerCommand(
	"auditionSelectionAfter",
	["KeyN"],
	t("settingsDialog.keybindings.auditionSelectionAfter"),
	"Spectrogram",
);

export const cmdCancelTimelineEditing = registerCommand(
	"cancelTimelineEditing",
	["Escape"],
	t("settingsDialog.keybindings.cancelTimelineEditing"),
	"Spectrogram",
);

export const cmdToggleSpectrogramFollow = registerCommand(
	"toggleSpectrogramFollow",
	["Shift", "KeyP"],
	t("spectrogramFollow.shortcut"),
	"Spectrogram",
);

if (import.meta.env.DEV) {
	t("settingsDialog.keybindings.category.File");
	t("settingsDialog.keybindings.category.Edit");
	t("settingsDialog.keybindings.category.View");
	t("settingsDialog.keybindings.category.Sync");
	t("settingsDialog.keybindings.category.Audio");
	t("settingsDialog.keybindings.category.Spectrogram");
	// Menu and ribbon actions (src/modules/menu-actions) register these.
	t("settingsDialog.keybindings.category.Tools");
	t("settingsDialog.keybindings.category.Help");
	t("settingsDialog.keybindings.category.Preview");
}
