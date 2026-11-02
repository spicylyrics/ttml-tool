import type {
	ProjectInfo,
	ProjectVersion,
} from "$/modules/project/autosave/autosave";
import { formatKeybindingLabel, formatSettingLabel } from "./labels";
import { BACKUP_CATEGORY_IDS, type BackupCategoryId } from "./types";

export interface ExportPreviewItem {
	/** Unique within its category (storage key, project id, plugin id...). */
	key: string;
	label: string;
	detail: string;
	bytes: number;
}

export interface ExportPreviewCategory {
	id: BackupCategoryId;
	items: ExportPreviewItem[];
	bytes: number;
}

export interface ExportPreview {
	categories: ExportPreviewCategory[];
	totalBytes: number;
}

export interface ExportPreviewParts {
	settings: Record<string, string>;
	keybindings: Record<string, string>;
	apiKeys?: Record<string, string>;
	background: { mime: string; bytes: number } | null;
	appearancePresets?: Array<{ id: string; name: string; bytes: number }>;
	customFont?: { name: string; bytes: number } | null;
	projects: ProjectInfo[];
	versions: ProjectVersion[];
}

/** Translatable strings used when building item labels. */
export interface ExportPreviewLabels {
	preset: string;
	customFont: string;
	versions: (count: number) => string;
}

const DEFAULT_LABELS: ExportPreviewLabels = {
	preset: "Preset",
	customFont: "Custom Font",
	versions: (count) => `${count} versions`,
};

export const EXPORT_PREVIEW_ITEM_LIMIT = 8;

export function formatPreviewBytes(bytes: number): string {
	if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";
	if (bytes < 1024) return `${Math.round(bytes)} B`;
	if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
	return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function storageItems(
	record: Record<string, string>,
	isKeybindings = false,
): ExportPreviewItem[] {
	return Object.keys(record)
		.sort()
		.map((key) => ({
			key,
			label: isKeybindings
				? formatKeybindingLabel(key)
				: formatSettingLabel(key),
			detail: formatPreviewBytes(record[key].length),
			bytes: record[key].length,
		}));
}

function toCategory(
	id: BackupCategoryId,
	items: ExportPreviewItem[],
): ExportPreviewCategory {
	return {
		id,
		items,
		bytes: items.reduce((sum, item) => sum + item.bytes, 0),
	};
}

export function summarizeExportParts(
	parts: ExportPreviewParts,
	selected: Set<BackupCategoryId>,
	labels: ExportPreviewLabels = DEFAULT_LABELS,
): ExportPreview {
	const categories: ExportPreviewCategory[] = [];

	for (const id of BACKUP_CATEGORY_IDS) {
		if (!selected.has(id)) continue;
		if (id === "settings") {
			categories.push(toCategory(id, storageItems(parts.settings, false)));
		} else if (id === "keybindings") {
			categories.push(toCategory(id, storageItems(parts.keybindings, true)));
		} else if (id === "assets") {
			const items: ExportPreviewItem[] = [];
			for (const preset of parts.appearancePresets ?? []) {
				items.push({
					key: `preset:${preset.id}`,
					label: `${labels.preset}: ${preset.name}`,
					detail: formatPreviewBytes(preset.bytes),
					bytes: preset.bytes,
				});
			}
			if (parts.customFont) {
				items.push({
					key: "customFont",
					label: `${labels.customFont}: ${parts.customFont.name}`,
					detail: formatPreviewBytes(parts.customFont.bytes),
					bytes: parts.customFont.bytes,
				});
			}
			if (parts.background) {
				items.push({
					key: "background",
					label: parts.background.mime,
					detail: formatPreviewBytes(parts.background.bytes),
					bytes: parts.background.bytes,
				});
			}
			categories.push(toCategory(id, items));
		} else if (id === "apiKeys") {
			const apiKeys = parts.apiKeys ?? {};
			const items = Object.keys(apiKeys)
				.sort()
				.map((key) => ({
					key,
					label: formatSettingLabel(key),
					detail: formatPreviewBytes(apiKeys[key].length),
					bytes: apiKeys[key].length,
				}));
			categories.push(toCategory(id, items));
		} else if (id === "projects") {
			const versionsByProject = new Map<string, ProjectVersion[]>();
			for (const version of parts.versions) {
				const list = versionsByProject.get(version.projectId);
				if (list) list.push(version);
				else versionsByProject.set(version.projectId, [version]);
			}
			const items = [...parts.projects]
				.sort((a, b) => a.name.localeCompare(b.name))
				.map((project) => {
					const projectVersions = versionsByProject.get(project.id) ?? [];
					return {
						key: project.id,
						label: project.name,
						detail: labels.versions(projectVersions.length),
						bytes:
							JSON.stringify(project).length +
							JSON.stringify(projectVersions).length,
					};
				});
			categories.push(toCategory(id, items));
		}
	}

	return {
		categories,
		totalBytes: categories.reduce((sum, category) => sum + category.bytes, 0),
	};
}

/**
 * Loads the raw data behind the selected categories in a single pass, so the
 * counts and the preview can share it instead of reading everything twice.
 */
export async function loadExportParts(
	selected: Set<BackupCategoryId>,
): Promise<ExportPreviewParts> {
	const parts: ExportPreviewParts = {
		settings: {},
		keybindings: {},
		apiKeys: {},
		background: null,
		appearancePresets: [],
		customFont: null,
		projects: [],
		versions: [],
	};
	if (selected.size === 0) return parts;

	const jobs: Array<Promise<void>> = [];

	if (
		selected.has("settings") ||
		selected.has("keybindings") ||
		selected.has("apiKeys")
	) {
		const { partitionLocalStorage } = await import("./export");
		const { settings, keybindings, apiKeys } = partitionLocalStorage();
		parts.settings = settings;
		parts.keybindings = keybindings;
		parts.apiKeys = apiKeys;
	}
	if (selected.has("assets")) {
		try {
			const rawPresets = localStorage.getItem("appearancePresets");
			if (rawPresets) {
				const parsed = JSON.parse(rawPresets);
				if (Array.isArray(parsed)) {
					parts.appearancePresets = parsed.map(
						(p: { id?: unknown; name?: unknown }) => ({
							id: String(p.id ?? ""),
							name: String(p.name ?? "Theme"),
							bytes: JSON.stringify(p).length,
						}),
					);
				}
			}
		} catch {}

		try {
			const fontName = localStorage.getItem("customFontName");
			const fontData = localStorage.getItem("customFontData");
			if (fontName && fontData) {
				parts.customFont = {
					name: fontName,
					bytes: fontData.length,
				};
			}
		} catch {}

		jobs.push(
			import("$/modules/settings/modals/customBackground").then(
				async ({ readCustomBackgroundBlob }) => {
					const blob = await readCustomBackgroundBlob();
					parts.background = blob
						? {
								mime: blob.type || "image/png",
								// The export stores the image as base64 (4 bytes per 3).
								bytes: Math.ceil(blob.size / 3) * 4,
							}
						: null;
				},
			),
		);
	}
	if (selected.has("projects")) {
		jobs.push(
			import("$/modules/project/autosave/autosave").then(
				async ({ exportAllProjectsData }) => {
					const { projects, versions } = await exportAllProjectsData();
					parts.projects = projects;
					parts.versions = versions;
				},
			),
		);
	}
	await Promise.all(jobs);
	return parts;
}
