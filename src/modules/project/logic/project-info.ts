import type { TTMLLyric } from "$/types/ttml";

/**
 * @description 用于识别项目的元数据键列表。
 * 按优先级从高到低排序，如果匹配到前面的 ID，则使用该 ID 生成 `sourceLabel`
 */
export const ID_SOURCES = [
	{ key: "ncmMusicId", label: "NCM" },
	{ key: "qqMusicId", label: "QQ" },
	{ key: "spotifyId", label: "Spotify" },
	{ key: "appleMusicId", label: "Apple" },
	{ key: "isrc", label: "ISRC" },
];

/**
 * @description 描述项目在 UI 上显示的相关信息
 */
export interface ProjectIdentity {
	name: string;
	artist: string;
	/**
	 * @description 显示名称 (`Title - Artist` 或 `Untitled (NCM: 123)` 等)
	 */
	displayName: string;
	/**
	 * @description 标记是否为未命名项目，即没有标题且没有艺术家元数据的项目
	 */
	isUntitled: boolean;
}

/**
 * @description 根据元数据内容计算出该项目应该如何在 UI 上显示
 * @param lyrics - 需要识别的歌词对象
 * @returns
 */
export function identifyProject(
	lyrics: Pick<TTMLLyric, "metadata">,
): ProjectIdentity {
	const getMeta = (key: string) =>
		lyrics.metadata.find((m) => m.key.toLowerCase() === key.toLowerCase())
			?.value[0];

	const title = getMeta("musicName")?.trim() || "";
	const artist = getMeta("artists")?.trim() || "";

	for (const source of ID_SOURCES) {
		const idValue = getMeta(source.key)?.trim();
		if (idValue) {
			if (title) {
				return {
					name: title,
					artist: artist,
					displayName: artist ? `${title} - ${artist}` : title,
					isUntitled: false,
				};
			}

			return {
				name: "",
				artist: "",
				displayName: `Untitled (${source.label}: ${idValue})`,
				isUntitled: true,
			};
		}
	}

	if (title && artist) {
		return {
			name: title,
			artist: artist,
			displayName: `${title} - ${artist}`,
			isUntitled: false,
		};
	}
	if (title) {
		return {
			name: title,
			artist: "",
			displayName: title,
			isUntitled: false,
		};
	}

	return {
		name: "",
		artist: "",
		displayName: "Untitled Project",
		isUntitled: true,
	};
}
