import { ToolMode } from "$/states/main";
import type { TTMLLyric } from "$/types/ttml";

export const PRESENCE_BRIDGE_VERSION = 1;
export const PRESENCE_META_NAME = "amll-discord-presence";
export const DEFAULT_DISCORD_DETAILS_TEMPLATE = "{{mode}} {{title}}";
export const DEFAULT_DISCORD_STATE_TEMPLATE =
	"[[{{artist}} • ]]{{lineProgress}} • {{playbackStatus}}";

export const DISCORD_TEMPLATE_VARIABLES = [
	"title",
	"fileName",
	"artist",
	"album",
	"songwriters",
	"mode",
	"lineProgress",
	"currentLine",
	"totalLines",
	"currentLineText",
	"selectedLines",
	"selectedWords",
	"totalWords",
	"sectionCount",
	"playbackStatus",
	"position",
	"duration",
	"remaining",
	"playbackRate",
	"projectElapsed",
	"appName",
] as const;

export type DiscordTemplateVariable =
	(typeof DISCORD_TEMPLATE_VARIABLES)[number];
export type DiscordTemplateContext = Record<DiscordTemplateVariable, string>;

export interface PresenceSnapshot {
	version: typeof PRESENCE_BRIDGE_VERSION;
	mode: ToolMode;
	title: string;
	artist: string;
	currentLine: number | null;
	totalLines: number;
	playing: boolean;
	positionSeconds: number;
	durationSeconds: number;
	playbackRate: number;
	projectElapsedSeconds?: number;
	coverUrl?: string | null;
}

export interface DiscordActivityPayload {
	details?: string;
	state?: string;
	playing: boolean;
	showRepositoryButton: boolean;
	showStatusBadge: boolean;
	startTimestamp?: number;
	endTimestamp?: number;
	largeImage?: string;
}

export interface DiscordActivityOptions {
	detailsTemplate: string;
	stateTemplate: string;
	showPlaybackTimeline: boolean;
	showProjectElapsed: boolean;
	showRepositoryButton: boolean;
	showStatusBadge: boolean;
}

const metadataValues = (lyrics: TTMLLyric, key: string) =>
	lyrics.metadata
		.find((entry) => entry.key.toLowerCase() === key.toLowerCase())
		?.value.map((value) => value.trim())
		.filter(Boolean) ?? [];

const firstMetadataValue = (lyrics: TTMLLyric, key: string) =>
	metadataValues(lyrics, key)[0] ?? "";

const normalizeDiscordImageUrl = (value: string | undefined) => {
	const trimmed = value?.trim();
	if (!trimmed) return null;
	try {
		const url = new URL(trimmed);
		return url.protocol === "https:" || url.protocol === "http:"
			? trimmed
			: null;
	} catch {
		return null;
	}
};

export function createPresenceSnapshot({
	lyrics,
	fileName,
	mode,
	selectedLineIds,
	playing,
	positionSeconds,
	durationSeconds,
	playbackRate,
	projectElapsedSeconds,
}: {
	lyrics: TTMLLyric;
	fileName: string;
	mode: ToolMode;
	selectedLineIds: Set<string>;
	playing: boolean;
	positionSeconds: number;
	durationSeconds: number;
	playbackRate: number;
	projectElapsedSeconds?: number;
}): PresenceSnapshot {
	const primaryLines = lyrics.lyricLines.filter((line) => !line.isBG);
	let currentIndex = -1;

	if (mode === ToolMode.Preview) {
		const positionMs = positionSeconds * 1000;
		currentIndex = primaryLines.findIndex(
			(line) => positionMs >= line.startTime && positionMs <= line.endTime,
		);
	} else {
		currentIndex = primaryLines.findIndex((line) =>
			selectedLineIds.has(line.id),
		);
	}

	const coverUrl = normalizeDiscordImageUrl(
		lyrics.metadata
			.find((entry) => entry.key.toLowerCase() === "cover_art")
			?.value.find((value) => value.trim().length > 0),
	);

	return {
		version: PRESENCE_BRIDGE_VERSION,
		mode,
		title:
			firstMetadataValue(lyrics, "musicName") ||
			fileName.replace(/\.(?:ttml|lrc|txt)$/i, "").trim(),
		artist: firstMetadataValue(lyrics, "artists"),
		currentLine: currentIndex >= 0 ? currentIndex + 1 : null,
		totalLines: primaryLines.length,
		playing,
		positionSeconds: Math.max(0, positionSeconds),
		durationSeconds: Math.max(0, durationSeconds),
		playbackRate: Math.max(0.01, playbackRate),
		projectElapsedSeconds: Math.max(0, projectElapsedSeconds ?? 0),
		coverUrl,
	};
}

const modeLabels: Record<ToolMode, string> = {
	[ToolMode.Edit]: "Editing",
	[ToolMode.Sync]: "Syncing",
	[ToolMode.Preview]: "Previewing",
};

const truncateDiscordText = (value: string) =>
	Array.from(value).slice(0, 128).join("");

const formatClock = (seconds: number) => {
	const safeSeconds = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(safeSeconds / 3600);
	const minutes = Math.floor((safeSeconds % 3600) / 60);
	const remainder = safeSeconds % 60;
	return hours > 0
		? `${hours}:${minutes.toString().padStart(2, "0")}:${remainder.toString().padStart(2, "0")}`
		: `${minutes}:${remainder.toString().padStart(2, "0")}`;
};

const formatElapsed = (seconds: number) => {
	const safeSeconds = Math.max(0, Math.floor(seconds));
	const hours = Math.floor(safeSeconds / 3600);
	const minutes = Math.floor((safeSeconds % 3600) / 60);
	if (hours > 0) return minutes > 0 ? `${hours}h ${minutes}m` : `${hours}h`;
	if (minutes > 0) return `${minutes}m`;
	return `${safeSeconds}s`;
};

const templateVariableSet = new Set<string>(DISCORD_TEMPLATE_VARIABLES);
const placeholderPattern = /\{\{([A-Za-z][A-Za-z0-9]*)\}\}/g;

export function validateDiscordTemplate(template: string): string | null {
	let optionalDepth = 0;
	for (let index = 0; index < template.length; index++) {
		const pair = template.slice(index, index + 2);
		if (pair === "[[") {
			if (optionalDepth > 0) return "Optional segments cannot be nested.";
			optionalDepth++;
			index++;
		} else if (pair === "]]") {
			if (optionalDepth === 0) return "Unexpected optional segment ending.";
			optionalDepth--;
			index++;
		}
	}
	if (optionalDepth > 0) return "Optional segment is not closed.";

	let unknownVariable = "";
	const withoutPlaceholders = template.replace(
		placeholderPattern,
		(_match, variable: string) => {
			if (!templateVariableSet.has(variable)) unknownVariable = variable;
			return "";
		},
	);
	if (unknownVariable) return `Unknown variable: ${unknownVariable}`;
	if (withoutPlaceholders.includes("{{") || withoutPlaceholders.includes("}}"))
		return "Malformed template variable.";
	return null;
}

export function renderDiscordTemplate(
	template: string,
	context: DiscordTemplateContext,
): string {
	const validationError = validateDiscordTemplate(template);
	if (validationError) throw new Error(validationError);

	const renderVariables = (value: string) =>
		value.replace(
			placeholderPattern,
			(_match, variable: DiscordTemplateVariable) => context[variable],
		);
	const withOptionalSegments = template.replace(
		/\[\[([^[\]]*)\]\]/g,
		(_match, segment: string) => {
			const variables = Array.from(segment.matchAll(placeholderPattern));
			return variables.some(
				(match) => !context[match[1] as DiscordTemplateVariable],
			)
				? ""
				: renderVariables(segment);
		},
	);
	return renderVariables(withOptionalSegments).trim();
}

export function createDiscordTemplateContext({
	snapshot,
	lyrics,
	fileName,
	selectedLineIds,
	selectedWordIds,
}: {
	snapshot: PresenceSnapshot;
	lyrics: TTMLLyric;
	fileName: string;
	selectedLineIds: ReadonlySet<string>;
	selectedWordIds: ReadonlySet<string>;
}): DiscordTemplateContext {
	const primaryLines = lyrics.lyricLines.filter((line) => !line.isBG);
	const currentLine = snapshot.currentLine
		? primaryLines[snapshot.currentLine - 1]
		: undefined;
	const lineProgress = snapshot.currentLine
		? `Line ${snapshot.currentLine} of ${snapshot.totalLines}`
		: snapshot.totalLines > 0
			? `${snapshot.totalLines} lines`
			: "No lyrics yet";
	const playbackStatus = snapshot.playing
		? "Playing"
		: snapshot.durationSeconds > 0
			? "Paused"
			: "No audio loaded";

	return {
		title: snapshot.title || "Untitled lyrics",
		fileName,
		artist: snapshot.artist,
		album: firstMetadataValue(lyrics, "album"),
		songwriters: metadataValues(lyrics, "songwriter").join(", "),
		mode: modeLabels[snapshot.mode],
		lineProgress,
		currentLine: snapshot.currentLine?.toString() ?? "",
		totalLines: snapshot.totalLines.toString(),
		currentLineText:
			currentLine?.words?.map((word) => word.word).join("") ?? "",
		selectedLines: selectedLineIds.size.toString(),
		selectedWords: selectedWordIds.size.toString(),
		totalWords: lyrics.lyricLines
			.reduce((total, line) => total + (line.words?.length ?? 0), 0)
			.toString(),
		sectionCount: (lyrics.sections?.length ?? 0).toString(),
		playbackStatus,
		position: formatClock(snapshot.positionSeconds),
		duration:
			snapshot.durationSeconds > 0 ? formatClock(snapshot.durationSeconds) : "",
		remaining:
			snapshot.durationSeconds > 0
				? formatClock(snapshot.durationSeconds - snapshot.positionSeconds)
				: "",
		playbackRate: `${Number(snapshot.playbackRate.toFixed(2))}×`,
		projectElapsed: formatElapsed(snapshot.projectElapsedSeconds ?? 0),
		appName: "TTML Tool",
	};
}

export function formatNativeDiscordActivity(
	snapshot: PresenceSnapshot,
	context: DiscordTemplateContext,
	options: DiscordActivityOptions,
	nowSeconds = Math.floor(Date.now() / 1000),
): DiscordActivityPayload {
	const details = truncateDiscordText(
		renderDiscordTemplate(options.detailsTemplate, context),
	);
	const state = truncateDiscordText(
		renderDiscordTemplate(options.stateTemplate, context),
	);
	const payload: DiscordActivityPayload = {
		...(details ? { details } : {}),
		...(state ? { state } : {}),
		playing: snapshot.playing,
		showRepositoryButton: options.showRepositoryButton,
		showStatusBadge: options.showStatusBadge,
		largeImage: snapshot.coverUrl || undefined,
	};

	if (
		options.showPlaybackTimeline &&
		snapshot.playing &&
		snapshot.durationSeconds > snapshot.positionSeconds
	) {
		const elapsed = snapshot.positionSeconds / snapshot.playbackRate;
		const remaining =
			(snapshot.durationSeconds - snapshot.positionSeconds) /
			snapshot.playbackRate;
		payload.startTimestamp = Math.floor(nowSeconds - elapsed);
		payload.endTimestamp = Math.ceil(nowSeconds + remaining);
	} else if (
		options.showProjectElapsed &&
		(snapshot.projectElapsedSeconds ?? 0) > 0
	) {
		payload.startTimestamp = Math.floor(
			nowSeconds - (snapshot.projectElapsedSeconds ?? 0),
		);
	}

	return payload;
}

export function createInactiveDiscordActivity(): DiscordActivityPayload {
	return {
		details: "TTML Tool",
		state: "Inactive",
		playing: false,
		showRepositoryButton: false,
		showStatusBadge: false,
	};
}

export function formatDiscordActivity(
	snapshot: PresenceSnapshot,
	nowSeconds = Math.floor(Date.now() / 1000),
): DiscordActivityPayload {
	const subject = snapshot.title || "Untitled lyrics";
	const progress = snapshot.currentLine
		? `Line ${snapshot.currentLine} of ${snapshot.totalLines}`
		: snapshot.totalLines > 0
			? `${snapshot.totalLines} lines`
			: "No lyrics yet";
	const playbackStatus = snapshot.playing
		? "Playing"
		: snapshot.durationSeconds > 0
			? "Paused"
			: "No audio loaded";
	const stateBase = snapshot.artist
		? `${snapshot.artist} • ${progress}`
		: progress;
	const state = `${stateBase} • ${playbackStatus}`;
	const payload: DiscordActivityPayload = {
		details: truncateDiscordText(`${modeLabels[snapshot.mode]} ${subject}`),
		state: truncateDiscordText(state),
		playing: snapshot.playing,
		showRepositoryButton: true,
		showStatusBadge: true,
		largeImage: snapshot.coverUrl || undefined,
	};

	if (snapshot.playing && snapshot.durationSeconds > snapshot.positionSeconds) {
		const elapsed = snapshot.positionSeconds / snapshot.playbackRate;
		const remaining =
			(snapshot.durationSeconds - snapshot.positionSeconds) /
			snapshot.playbackRate;
		payload.startTimestamp = Math.floor(nowSeconds - elapsed);
		payload.endTimestamp = Math.ceil(nowSeconds + remaining);
	} else if ((snapshot.projectElapsedSeconds ?? 0) > 0) {
		payload.startTimestamp = Math.floor(
			nowSeconds - (snapshot.projectElapsedSeconds ?? 0),
		);
	}

	return payload;
}
