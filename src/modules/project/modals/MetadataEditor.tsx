import {
	Add16Regular,
	AlbumRegular,
	Delete16Regular,
	Image16Regular,
	Info16Regular,
	MusicNote1Regular,
	Open16Regular,
	Person16Regular,
	Search16Regular,
} from "@fluentui/react-icons";
import {
	Box,
	Button,
	Dialog,
	DropdownMenu,
	Flex,
	IconButton,
	Link,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useSetAtom } from "jotai";
import { useSetImmerAtom } from "jotai-immer";
import {
	memo,
	type ReactNode,
	useCallback,
	useEffect,
	useMemo,
	useRef,
	useState,
} from "react";
import { useTranslation } from "react-i18next";
import { useLyricLinesWhileOpen } from "$/hooks/useLyricLinesWhileOpen.ts";
import { getBetterGeniusCoverArt } from "$/modules/genius/utils/image";
import { getGuideUrl } from "$/modules/onboarding/logic";
import {
	geniusSearchDialogAtom,
	metadataEditorDialogAtom,
} from "$/states/dialogs.ts";
import { lyricLinesAtom } from "$/states/main.ts";
import type { TTMLLyric } from "$/types/ttml";
import styles from "./MetadataEditor.module.css";
import { GithubIcon } from "./PlatformIcons";

interface MetadataEntryProps {
	entry: { key: string; value: string[] };
	index: number;
	setLyricLines: (args: (prev: TTMLLyric) => void) => void;
	option: SelectOption | null;
	focusAddKeyButton: () => void;
}

const MetadataEntry = memo(
	({
		entry,
		index,
		setLyricLines,
		option,
		focusAddKeyButton,
	}: MetadataEntryProps) => {
		const validation = option?.validation;
		const rowHasError = validation
			? entry.value.some(
					(val) => val.trim() !== "" && !validation.verifier(val),
				)
			: false;

		const rowHasDuplicate = useMemo(() => {
			const values = entry.value.filter((v) => v.trim() !== "");
			return new Set(values).size !== values.length;
		}, [entry.value]);

		const { t } = useTranslation();

		const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

		const [focusIndex, setFocusIndex] = useState<number | null>(null);

		useEffect(() => {
			if (focusIndex !== null) {
				const targetInput = inputRefs.current[focusIndex];
				if (targetInput) {
					targetInput.focus();
					const len = targetInput.value.length;
					targetInput.setSelectionRange(len, len);
				}
				setFocusIndex(null);
			}
		}, [focusIndex]);

		const [isDraggingCategory, setIsDraggingCategory] = useState(false);
		const [dragInputIndex, setDragInputIndex] = useState<number | null>(null);

		const handleCategoryDrop = useCallback(
			(e: React.DragEvent) => {
				e.preventDefault();
				setIsDraggingCategory(false);
				const text = e.dataTransfer.getData("text");
				if (!text) return;

				const parts = text
					.split(/[\n,;/，；、|\\]/)
					.map((s) => s.trim())
					.filter((s) => s !== "");

				if (parts.length === 0) return;

				setLyricLines((prev) => {
					const currentList = prev.metadata[index].value;
					const existingSet = new Set<string>();
					const emptyIndices: number[] = [];

					currentList.forEach((val, i) => {
						if (val.trim() === "") {
							emptyIndices.push(i);
						} else {
							existingSet.add(val);
						}
					});

					for (const part of parts) {
						if (existingSet.has(part)) continue;

						if (emptyIndices.length > 0) {
							// biome-ignore lint/style/noNonNullAssertion: 肯定有
							const slotIndex = emptyIndices.shift()!;
							currentList[slotIndex] = part;
						} else {
							currentList.push(part);
						}
						existingSet.add(part);
					}
				});
			},
			[index, setLyricLines],
		);

		return (
			<tbody
				className={isDraggingCategory ? styles.dragOverCategory : undefined}
				onDragOver={(e) => {
					e.preventDefault();
					setIsDraggingCategory(true);
				}}
				onDragLeave={(e) => {
					if (!e.currentTarget.contains(e.relatedTarget as Node)) {
						setIsDraggingCategory(false);
					}
				}}
				onDrop={handleCategoryDrop}
			>
				{entry.value.map((vv, ii) => {
					const itemHasError = validation
						? vv.trim() !== "" && !validation.verifier(vv)
						: false;
					const isDuplicate =
						vv.trim() !== "" && entry.value.filter((v) => v === vv).length > 1;
					const hasAnyError = itemHasError || isDuplicate;

					const url = option?.urlFormatter?.(vv);
					const isLinkable = !!option?.isLinkable;
					const isValid = validation ? validation.verifier(vv) : true;
					const isButtonEnabled = !!url && isValid;

					return (
						<tr key={`metadata-${entry.key}-${ii}`}>
							<td>
								{ii === 0 && (
									<Flex
										align="center"
										gap="2"
										style={{
											width: "100%",
										}}
									>
										<span
											style={{
												display: "flex",
												color: "var(--gray-12)",
											}}
										>
											{option?.icon || <Info16Regular />}
										</span>

										<Text
											style={{
												whiteSpace: "normal",
												wordBreak: "break-word",
											}}
										>
											{option?.label || entry.key}
										</Text>
									</Flex>
								)}
								{ii === 0 && option?.description && (
									<Text
										as="p"
										size="1"
										color="gray"
										mt="1"
										style={{ whiteSpace: "normal" }}
									>
										{option.description}
										{option.guideLink && (
											<>
												{" "}
												<Link
													href={option.guideLink.url}
													target="_blank"
													rel="noopener noreferrer"
												>
													{option.guideLink.label}
												</Link>
											</>
										)}
									</Text>
								)}
							</td>
							<td>
								<Flex gap="1" ml="2" mt="1">
									<TextField.Root
										data-metadata-input="true"
										ref={(el) => {
											inputRefs.current[ii] = el;
										}}
										onKeyDown={(e) => {
											if (e.key === "Enter") {
												e.preventDefault();
												setLyricLines((prev) => {
													prev.metadata[index].value.splice(ii + 1, 0, "");
												});
												setFocusIndex(ii + 1);
											} else if (
												e.key === "Backspace" &&
												e.currentTarget.value === ""
											) {
												if (e.repeat) return;

												e.preventDefault();

												if (ii > 0) {
													setLyricLines((prev) => {
														prev.metadata[index].value.splice(ii, 1);
													});
													setFocusIndex(ii - 1);
												} else {
													setLyricLines((prev) => {
														prev.metadata[index].value.splice(ii, 1);
														if (prev.metadata[index].value.length === 0) {
															prev.metadata.splice(index, 1);
														}
													});
												}
											} else if (e.key === "Tab" && !e.shiftKey) {
												const allInputs = Array.from(
													document.querySelectorAll<HTMLInputElement>(
														'[data-metadata-input="true"]',
													),
												);
												const currentIndex = allInputs.indexOf(e.currentTarget);
												const nextInput =
													currentIndex >= 0
														? allInputs[currentIndex + 1]
														: null;

												e.preventDefault();
												if (nextInput) {
													nextInput.focus();
													const len = nextInput.value.length;
													nextInput.setSelectionRange(len, len);
												} else {
													focusAddKeyButton();
												}
											}
										}}
										value={vv}
										className={`${styles.metadataInput} ${
											dragInputIndex === ii ? styles.dragOverInput : ""
										}`}
										onChange={(e) => {
											const newValue = e.currentTarget.value;
											setLyricLines((prev) => {
												prev.metadata[index].value[ii] = newValue;
											});
										}}
										onDragOver={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setDragInputIndex(ii);
										}}
										onDragLeave={() => setDragInputIndex(null)}
										onDrop={(e) => {
											e.preventDefault();
											e.stopPropagation();
											setDragInputIndex(null);
											setIsDraggingCategory(false);
											const text = e.dataTransfer.getData("text");
											if (text) {
												setLyricLines((prev) => {
													prev.metadata[index].value[ii] = text;
												});
											}
										}}
										variant={hasAnyError ? "soft" : "surface"}
										color={
											itemHasError
												? validation?.severe
													? "red"
													: "orange"
												: isDuplicate
													? "red"
													: undefined
										}
									/>
									{entry.key === "cover_art" && vv && (
										<Box
											style={{
												width: "32px",
												height: "32px",
												borderRadius: "4px",
												overflow: "hidden",
												flexShrink: 0,
											}}
										>
											<img
												src={getBetterGeniusCoverArt(vv, 100)}
												alt="Cover"
												style={{
													width: "100%",
													height: "100%",
													objectFit: "cover",
												}}
												referrerPolicy="no-referrer"
											/>
										</Box>
									)}
									{isLinkable && (
										<IconButton
											disabled={!isButtonEnabled}
											asChild={isButtonEnabled}
											variant="soft"
											title={t("metadataDialog.openLink", "打开链接")}
										>
											{isButtonEnabled ? (
												<a
													href={url || ""}
													target="_blank"
													rel="noopener noreferrer"
												>
													<Open16Regular />
												</a>
											) : (
												<Open16Regular />
											)}
										</IconButton>
									)}
									<IconButton
										variant="soft"
										onClick={() => {
											setLyricLines((prev) => {
												prev.metadata[index].value.splice(ii, 1);
												if (prev.metadata[index].value.length === 0) {
													prev.metadata.splice(index, 1);
												}
											});
										}}
									>
										<Delete16Regular />
									</IconButton>
								</Flex>
							</td>
						</tr>
					);
				})}
				<tr className={styles.newItemLine}>
					<td />
					<td className={styles.newItemBtnRow}>
						<Flex direction="column">
							{validation && rowHasError && (
								<Text
									color={validation.severe ? "red" : "orange"}
									size="1"
									mb="1"
									mt="1"
									wrap="wrap"
								>
									{validation.message}
								</Text>
							)}
							{rowHasDuplicate && (
								<Text color="red" size="1" mb="1" mt="1" wrap="wrap">
									{t(
										"metadataDialog.duplicateMsg",
										"Some metadata values are duplicated",
									)}
								</Text>
							)}
							<Button
								variant="soft"
								my="1"
								onClick={() => {
									setLyricLines((prev) => {
										prev.metadata[index].value.push("");
									});
								}}
							>
								{t("metadataDialog.addValue", "添加")}
							</Button>
						</Flex>
					</td>
				</tr>
			</tbody>
		);
	},
);

interface SelectOption {
	label: string;
	value: string;
	icon: ReactNode;
	/** Help text shown under the label, on the field's first row. */
	description?: string;
	/** Guide link appended to the description. */
	guideLink?: { url: string; label: string };
	isLinkable?: true;
	urlFormatter?: (value: string) => string | null;
	validation?: {
		verifier: (value: string) => boolean;
		message: string;
		/** red for true, orange for false */
		severe?: boolean;
	};
}

export const MetadataEditor = () => {
	const [metadataEditorDialog, setMetadataEditorDialog] = useAtom(
		metadataEditorDialogAtom,
	);
	const [customKey, setCustomKey] = useState("");
	const lyricLines = useLyricLinesWhileOpen(metadataEditorDialog);
	const setLyricLines = useSetImmerAtom(lyricLinesAtom);
	const addKeyButtonRef = useRef<HTMLButtonElement | null>(null);
	const setGeniusSearchDialogOpen = useSetAtom(geniusSearchDialogAtom);

	const { t } = useTranslation();

	const builtinOptions: SelectOption[] = useMemo(() => {
		return [
			{
				// 歌词所匹配的歌曲名
				label: t("metadataDialog.builtinOptions.musicName", "Song title"),
				value: "musicName",
				icon: <MusicNote1Regular />,
			},
			{
				// 歌词所匹配的歌手名
				label: t("metadataDialog.builtinOptions.artists", "Artists"),
				value: "artists",
				icon: <Person16Regular />,
				description: t(
					"helpText.metadataArtists",
					'Who performs the song, as the track is credited on streaming services. Example: "Shake It Off" is by Taylor Swift.',
				),
				validation: {
					verifier: (value: string) => !/^.+[,;&，；、].+$/.test(value),
					message: t(
						"metadataDialog.builtinOptions.artistsInvalidMsg",
						"Add one entry per artist instead of separating names with commas or slashes. Ignore this if an artist's name really contains one.",
					),
				},
			},
			{
				label: t("metadataDialog.builtinOptions.songwriter", "词曲作者"),
				value: "songwriter",
				icon: <Person16Regular />,
				description: t(
					"helpText.metadataSongwriter",
					'Who wrote the music and lyrics, from the writing credits. Often different from the artists. Example: "Shake It Off" was written by Taylor Swift, Max Martin and Shellback.',
				),
				guideLink: {
					url: getGuideUrl("songwriters"),
					label: t(
						"helpText.openSongwritersGuide",
						"Open the songwriters guide",
					),
				},
				validation: {
					verifier: (value: string) => !/^.+[,;&，；、].+$/.test(value),
					message: t(
						"metadataDialog.builtinOptions.songwriterInvalidMsg",
						"Add one entry per songwriter instead of separating names with commas or slashes.",
					),
				},
			},
			{
				// 歌词所匹配的专辑名
				label: t("metadataDialog.builtinOptions.album", "Album"),
				value: "album",
				icon: <AlbumRegular />,
			},
			{
				label: t("metadataDialog.builtinOptions.coverArt", "Cover image URL"),
				value: "cover_art",
				icon: <Image16Regular />,
			},
		];
	}, [t]);

	const findOptionByKey = useCallback(
		(key: string) => {
			return builtinOptions.find((v) => v.value === key) || null;
		},
		[builtinOptions],
	);

	const focusAddKeyButton = useCallback(() => {
		addKeyButtonRef.current?.focus();
	}, []);

	return (
		<Dialog.Root
			open={metadataEditorDialog}
			onOpenChange={setMetadataEditorDialog}
		>
			<Dialog.Content className={styles.dialogContent}>
				<div className={styles.dialogHeader}>
					<Flex align="center" gap="2" justify="between">
						<Dialog.Title style={{ margin: 0 }}>
							{t("metadataDialog.title", "Metadata")}
						</Dialog.Title>
						<IconButton variant="ghost" color="gray" asChild>
							<a
								href="https://github.com/spicylyrics/ttml-tool"
								target="_blank"
								rel="noreferrer"
								title="GitHub"
							>
								<GithubIcon />
							</a>
						</IconButton>
					</Flex>
				</div>

				<div className={styles.dialogBody}>
					<table className={styles.metadataTable}>
						<thead>
							<tr>
								<th className={styles.keyColumn}>
									{t("metadataDialog.key", "元数据类型")}
								</th>
								<th>{t("metadataDialog.value", "值")}</th>
							</tr>
						</thead>
						{lyricLines.metadata.length === 0 && (
							<tbody>
								<tr style={{ height: "4em" }}>
									<td
										colSpan={2}
										style={{ color: "var(--gray-9)", textAlign: "center" }}
									>
										{t("metadataDialog.empty", "无任何元数据")}
									</td>
								</tr>
							</tbody>
						)}
						{lyricLines.metadata.map((v, i) => (
							<MetadataEntry
								key={`metadata-${v.key}`}
								entry={v}
								index={i}
								setLyricLines={setLyricLines}
								option={findOptionByKey(v.key)}
								focusAddKeyButton={focusAddKeyButton}
							/>
						))}
					</table>
				</div>
				<Flex
					gap="1"
					direction={{
						sm: "row",
						initial: "column",
					}}
					className={styles.dialogFooter}
				>
					<DropdownMenu.Root>
						<DropdownMenu.Trigger
							style={{
								flex: "1 0 auto",
							}}
						>
							<Button variant="soft" ref={addKeyButtonRef}>
								{t("metadataDialog.addKeyValue", "Add field")}
								<DropdownMenu.TriggerIcon />
							</Button>
						</DropdownMenu.Trigger>
						<DropdownMenu.Content>
							<Flex gap="1">
								<TextField.Root
									style={{
										flexGrow: "1",
									}}
									placeholder={t("metadataDialog.customKey", "Custom field")}
									value={customKey}
									onChange={(e) => setCustomKey(e.currentTarget.value)}
								/>
								<IconButton
									variant="soft"
									onClick={() => {
										setLyricLines((prev) => {
											const existsKey = prev.metadata.find(
												(k) => k.key === customKey,
											);
											if (existsKey) {
												existsKey.value.push("");
											} else {
												prev.metadata.push({
													key: customKey,
													value: [""],
												});
											}
										});
									}}
								>
									<Add16Regular />
								</IconButton>
							</Flex>
							{builtinOptions.map((v) => (
								<DropdownMenu.Item
									key={`builtin-option-${v.value}`}
									shortcut={v.value}
									onClick={() => {
										setLyricLines((prev) => {
											const existsKey = prev.metadata.find(
												(k) => k.key === v.value,
											);
											if (existsKey) {
												existsKey.value.push("");
											} else {
												prev.metadata.push({
													key: v.value,
													value: [""],
												});
											}
										});
									}}
								>
									<Flex gap="2" align="center">
										{v.icon}
										{v.label}
									</Flex>
								</DropdownMenu.Item>
							))}
						</DropdownMenu.Content>
					</DropdownMenu.Root>
					<Button
						style={{
							flex: "1 0 auto",
						}}
						variant="soft"
						onClick={() => setGeniusSearchDialogOpen(true)}
					>
						<Search16Regular />
						{t(
							"metadataDialog.fetchSongwriters.button",
							"Fetch songwriters from Genius",
						)}
					</Button>
					<Button
						style={{
							flex: "1 0 auto",
						}}
						variant="soft"
						onClick={() => {
							setLyricLines((prev) => {
								for (const option of builtinOptions) {
									const existsKey = prev.metadata.find(
										(k) => k.key === option.value,
									);
									if (!existsKey) {
										prev.metadata.push({
											key: option.value,
											value: [""],
										});
									}
								}
							});
						}}
					>
						{t("metadataDialog.addPresets", "Add all standard fields")}
					</Button>
					<Button
						style={{ flex: "1 0 auto" }}
						color="red"
						variant="solid"
						onClick={() => {
							setLyricLines((prev) => {
								prev.metadata = [];
							});
						}}
					>
						<Delete16Regular />
						{t("metadataDialog.clear", "清空")}
					</Button>
				</Flex>
			</Dialog.Content>
		</Dialog.Root>
	);
};
