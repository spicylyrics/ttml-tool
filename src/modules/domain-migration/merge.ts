import type { BackupFile } from "$/modules/settings/backup/types";

type Assets = NonNullable<BackupFile["categories"]["assets"]>;

export type MigrationConflictSummary = {
	settings: string[];
	keybindings: string[];
	apiKeys: string[];
	projects: string[];
	appearance: boolean;
};

export type MigrationMergeChoices = {
	replaceSettings: boolean;
	replaceKeybindings: boolean;
	replaceApiKeys: boolean;
	replaceAppearance: boolean;
	/**
	 * Copy mode: never overwrite a project already here. A newer incoming copy
	 * is added beside it, named by this function. Its id comes from the source
	 * project and time, so running the copy again doesn't add it twice.
	 */
	keepBothProjects?: (name: string) => string;
};

const differentEntries = (
	source: Record<string, string> = {},
	destination: Record<string, string> = {},
) =>
	Object.keys(source).filter(
		(key) => key in destination && source[key] !== destination[key],
	);

const hasAppearance = (assets: Assets | undefined) =>
	Boolean(
		assets &&
			(assets.backgroundImage ||
				assets.appearancePresets?.length ||
				assets.customFont),
	);

export function getMigrationConflicts(
	source: BackupFile,
	destination: BackupFile,
): MigrationConflictSummary {
	const sourceProjects = source.categories.projects?.projects ?? [];
	const destinationProjects = new Set(
		(destination.categories.projects?.projects ?? []).map(
			(project) => project.id,
		),
	);

	return {
		settings: differentEntries(
			source.categories.settings?.localStorage,
			destination.categories.settings?.localStorage,
		),
		keybindings: differentEntries(
			source.categories.keybindings?.localStorage,
			destination.categories.keybindings?.localStorage,
		),
		apiKeys: differentEntries(
			source.categories.apiKeys?.localStorage,
			destination.categories.apiKeys?.localStorage,
		),
		projects: sourceProjects
			.filter((project) => destinationProjects.has(project.id))
			.map((project) => project.id),
		appearance:
			hasAppearance(source.categories.assets) &&
			hasAppearance(destination.categories.assets),
	};
}

export function hasMigrationConflicts(conflicts: MigrationConflictSummary) {
	return (
		conflicts.settings.length > 0 ||
		conflicts.keybindings.length > 0 ||
		conflicts.apiKeys.length > 0 ||
		conflicts.projects.length > 0 ||
		conflicts.appearance
	);
}

function mergeAssets(
	source: Assets | undefined,
	destination: Assets | undefined,
	preferSource: boolean,
): Assets | undefined {
	if (!source && !destination) return undefined;
	const [preferred, other] = preferSource
		? [source, destination]
		: [destination, source];
	const presets = preferred?.appearancePresets?.length
		? preferred.appearancePresets
		: other?.appearancePresets;
	const customFont = preferred?.customFont ?? other?.customFont;
	return {
		backgroundImage:
			preferred?.backgroundImage ?? other?.backgroundImage ?? null,
		...(presets?.length ? { appearancePresets: presets } : {}),
		...(customFont ? { customFont } : {}),
	};
}

export function mergeMigrationBackup(
	source: BackupFile,
	destination: BackupFile,
	choices: MigrationMergeChoices,
): BackupFile {
	const destinationProjects = destination.categories.projects?.projects ?? [];
	const sourceProjects = source.categories.projects?.projects ?? [];
	const projectMap = new Map(
		destinationProjects.map((project) => [project.id, project]),
	);
	// Incoming project id -> the id it is stored under here, when it is stored.
	const incomingIds = new Map<string, string>();
	for (const sourceProject of sourceProjects) {
		const current = projectMap.get(sourceProject.id);
		if (!current) {
			projectMap.set(sourceProject.id, sourceProject);
			incomingIds.set(sourceProject.id, sourceProject.id);
		} else if (choices.keepBothProjects) {
			if (sourceProject.lastModified <= current.lastModified) continue;
			const id = `${sourceProject.id}~copy-${sourceProject.lastModified}`;
			if (projectMap.has(id)) continue;
			projectMap.set(id, {
				...sourceProject,
				id,
				name: choices.keepBothProjects(sourceProject.name),
			});
			incomingIds.set(sourceProject.id, id);
		} else if (sourceProject.lastModified >= current.lastModified) {
			projectMap.set(sourceProject.id, sourceProject);
			incomingIds.set(sourceProject.id, sourceProject.id);
		}
	}
	const replacedIds = new Set(incomingIds.values());
	const destinationVersions = destination.categories.projects?.versions ?? [];
	const sourceVersions = source.categories.projects?.versions ?? [];
	const mergedVersions = [
		...destinationVersions.filter(
			(version) => !replacedIds.has(version.projectId),
		),
		...sourceVersions.flatMap((version) => {
			const projectId = incomingIds.get(version.projectId);
			return projectId ? [{ ...version, projectId }] : [];
		}),
	];

	const mergeEntries = (
		destinationEntries: Record<string, string> = {},
		sourceEntries: Record<string, string> = {},
		replace: boolean,
	) =>
		replace
			? { ...destinationEntries, ...sourceEntries }
			: { ...sourceEntries, ...destinationEntries };

	const assets = mergeAssets(
		source.categories.assets,
		destination.categories.assets,
		choices.replaceAppearance,
	);

	return {
		...source,
		categories: {
			settings: {
				localStorage: mergeEntries(
					destination.categories.settings?.localStorage,
					source.categories.settings?.localStorage,
					choices.replaceSettings,
				),
			},
			keybindings: {
				localStorage: mergeEntries(
					destination.categories.keybindings?.localStorage,
					source.categories.keybindings?.localStorage,
					choices.replaceKeybindings,
				),
			},
			apiKeys: {
				localStorage: mergeEntries(
					destination.categories.apiKeys?.localStorage,
					source.categories.apiKeys?.localStorage,
					choices.replaceApiKeys,
				),
			},
			...(assets ? { assets } : {}),
			projects: {
				projects: [...projectMap.values()],
				versions: mergedVersions,
			},
		},
	};
}
