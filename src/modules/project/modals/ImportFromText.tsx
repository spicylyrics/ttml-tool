import {
	Button,
	Dialog,
	Flex,
	Grid,
	Select,
	Switch,
	Text,
	TextArea,
	TextField,
	Tabs,
	ScrollArea,
	Card,
	Badge,
	Separator,
} from "@radix-ui/themes";
import { Open16Regular, QuestionCircle16Regular } from "@fluentui/react-icons";
import { atom, useAtom, useAtomValue, useSetAtom, useStore } from "jotai";
import { atomWithStorage } from "jotai/utils";
import { memo, type PropsWithChildren, useCallback } from "react";
import { toast } from "react-toastify";
import {
	confirmDialogAtom,
	importFromTextDialogAtom,
} from "$/states/dialogs.ts";


import {
	isDirtyAtom,
	lyricLinesAtom,
	selectedLinesAtom,
	selectedWordsAtom,
} from "$/states/main.ts";

import { type LyricLine, newLyricLine, newLyricWord } from "$/types/ttml";
import { importAddSpacesAtom, importSplitHyphensAtom } from "$/modules/settings/states/index.ts";


import { error as logError } from "$/utils/logging.ts";


import styles from "./ImportFromText.module.css";
import error = toast.error;

import { useTranslation } from "react-i18next";

// type IModelDeltaDecoration = monaco.editor.IModelDeltaDecoration;
// type IEditorDecorationsCollection = monaco.editor.IEditorDecorationsCollection;

const PrefText = memo((props: PropsWithChildren) => (
	<Text color="gray" size="2">
		{props.children}
	</Text>
));

enum ImportMode {
	Lyric = "lyric",
	LyricTrans = "lyric-trans",
	LyricRoman = "lyric-roman",
	LyricTransRoman = "lyric-trans-roman",
}

enum LineSeparatorMode {
	Interleaved = "interleaved-line",
	SameLineSeparator = "same-line-separator",
}

const importModeAtom = atomWithStorage(
	"importFromText.importMode",
	ImportMode.Lyric,
);
const lineSeparatorModeAtom = atomWithStorage(
	"importFromText.lineSeparatorMode",
	LineSeparatorMode.Interleaved,
);
const lineSeparatorAtom = atomWithStorage("importFromText.lineSeparator", "|");
const swapTransAndRomanAtom = atomWithStorage(
	"importFromText.swapTransAndRoman",
	false,
);
const wordSeparatorAtom = atomWithStorage("importFromText.wordSeparator", "\\");
const enableSpecialPrefixAtom = atomWithStorage(
	"importFromText.enableSpecialPrefix",
	false,
);
const bgLyricPrefixAtom = atomWithStorage("importFromText.bgLyricPrefix", "<");
const duetLyricPrefixAtom = atomWithStorage(
	"importFromText.duetLyricPrefix",
	">",
);
const enableEmptyBeatAtom = atomWithStorage(
	"importFromText.enableEmptyBeat",
	false,
);
const emptyBeatSymbolAtom = atomWithStorage(
	"importFromText.emptyBeatSymbol",
	"^",
);
const isGuideClickedAtom = atomWithStorage(
	"importFromText.isGuideClicked",
	false,
);
const textValueAtom = atom("");



const ImportFromTextEditor = memo(() => {
	const [value, setValue] = useAtom(textValueAtom);
	return (
		<TextArea
			style={{
				height: "calc(80vh - 120px)",
				flex: "1 1 auto",
			}}
			value={value}
			onChange={(evt) => setValue(evt.currentTarget.value)}
		/>
	);
});

export const ImportFromText = () => {
	const setConfirmDialog = useSetAtom(confirmDialogAtom);
	const isDirty = useAtomValue(isDirtyAtom);
	const { t } = useTranslation();

	const [importFromTextDialog, setImportFromTextDialog] = useAtom(
		importFromTextDialogAtom,
	);

	const [importMode, setImportMode] = useAtom(importModeAtom);
	const [lineSeparatorMode, setLineSeparatorMode] = useAtom(
		lineSeparatorModeAtom,
	);
	const [lineSeparator, setLineSeparator] = useAtom(lineSeparatorAtom);
	const [swapTransAndRoman, setSwapTransAndRoman] = useAtom(
		swapTransAndRomanAtom,
	);
	const [wordSeparator, setWordSeparator] = useAtom(wordSeparatorAtom);
	const [enableSpecialPrefix, setEnableSpecialPrefix] = useAtom(
		enableSpecialPrefixAtom,
	);
	const [bgLyricPrefix, setBgLyricPrefix] = useAtom(bgLyricPrefixAtom);
	const [duetLyricPrefix, setDuetLyricPrefix] = useAtom(duetLyricPrefixAtom);
	const [enableEmptyBeat, setEnableEmptyBeat] = useAtom(enableEmptyBeatAtom);
	const [emptyBeatSymbol, setEmptyBeatSymbol] = useAtom(emptyBeatSymbolAtom);
	const [addSpaces, setAddSpaces] = useAtom(importAddSpacesAtom);
	const [splitHyphens, setSplitHyphens] = useAtom(importSplitHyphensAtom);
	const [isGuideClicked, setIsGuideClicked] = useAtom(isGuideClickedAtom);





	const store = useStore();

	const onImport = useCallback(
		(text: string) => {
			const importMode = store.get(importModeAtom);
			const lineSeparatorMode = store.get(lineSeparatorModeAtom);
			const lineSeparator = store.get(lineSeparatorAtom);
			const swapTransAndRoman = store.get(swapTransAndRomanAtom);
			const wordSeparator = store.get(wordSeparatorAtom);
			const enableSpecialPrefix = store.get(enableSpecialPrefixAtom);
			const bgLyricPrefix = store.get(bgLyricPrefixAtom);
			const duetLyricPrefix = store.get(duetLyricPrefixAtom);
			const enableEmptyBeat = store.get(enableEmptyBeatAtom);
			const emptyBeatSymbol = store.get(emptyBeatSymbolAtom);
			const addSpaces = store.get(importAddSpacesAtom);
			const splitHyphens = store.get(importSplitHyphensAtom);





			const lines = text.split("\n");
			const result: LyricLine[] = [];

			function addLine(orig = "", trans = "", roman = "") {
				let finalOrig = orig;
				let isBG = false;
				let isDuet = false;

				if (enableSpecialPrefix) {
					// 循环遍历是否存在前缀，有则与之分离
					while (true) {
						if (finalOrig.startsWith(bgLyricPrefix)) {
							isBG = true;
							finalOrig = finalOrig.slice(bgLyricPrefix.length);
						} else if (finalOrig.startsWith(duetLyricPrefix)) {
							isDuet = true;
							finalOrig = finalOrig.slice(duetLyricPrefix.length);
						} else {
							break;
						}
					}
				}

				const line: LyricLine = {
					...newLyricLine(),
					words: [
						{
							...newLyricWord(),
							word: finalOrig,
						},
					],
					translatedLyric: trans,
					romanLyric: roman,
					isBG,
					isDuet,
				};

				result.push(line);
				return line;
			}

			function addAsLyricOnly() {
				for (const line of lines) {
					addLine(line);
				}
			}

			type KeysMatching<T, V> = NonNullable<
				{ [K in keyof T]: T[K] extends V ? K : never }[keyof T]
			>;

			function addAsLyricWithSub(
				sub1?: KeysMatching<LyricLine, string>,
				sub2?: KeysMatching<LyricLine, string>,
			) {
				switch (lineSeparatorMode) {
					case LineSeparatorMode.Interleaved: {
						let skip = 1;
						if (sub1) skip++;
						if (sub2) skip++;
						for (let i = 0; i < lines.length; i += skip) {
							const orig = lines[i];
							let ii = 0;
							const subText1 = sub1 ? lines[i + ++ii] : "";
							const subText2 = sub2 ? lines[i + ++ii] : "";
							const line = addLine(orig);
							if (sub1) line[sub1] = subText1;
							if (sub2) line[sub2] = subText2;
						}
						return;
					}
					case LineSeparatorMode.SameLineSeparator: {
						for (const lineText of lines) {
							const parts = lineText.split(lineSeparator);
							const orig = parts[0];
							const subText1 = sub1 ? parts[1] : "";
							const subText2 = sub2 ? parts[2] : "";
							const line = addLine(orig);
							if (sub1) line[sub1] = subText1;
							if (sub2) line[sub2] = subText2;
						}
						return;
					}
				}
			}

			switch (importMode) {
				case ImportMode.Lyric:
					addAsLyricOnly();
					break;
				case ImportMode.LyricTrans:
					addAsLyricWithSub("translatedLyric");
					break;
				case ImportMode.LyricRoman:
					addAsLyricWithSub("romanLyric");
					break;
				case ImportMode.LyricTransRoman:
					addAsLyricWithSub("translatedLyric", "romanLyric");
					break;
			}

			if (swapTransAndRoman) {
				for (const line of result) {
					[line.romanLyric, line.translatedLyric] = [
						line.translatedLyric,
						line.romanLyric,
					];
				}
			}

			if (wordSeparator.length > 0 || addSpaces || splitHyphens) {
				for (const line of result) {
					const wholeLine = line.words.map((word) => word.word).join("");
					let words: string[];
					if (wordSeparator.length > 0) {
						const regex = new RegExp(`(${wordSeparator.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'g');
						words = wholeLine.split(regex).filter(p => p.length > 0);
					} else {
						words = [wholeLine];
					}

					if (splitHyphens) {
						// Split by hyphen but KEEP the hyphen at the end of the previous segment
						words = words.flatMap((w) => w.split(/(?<=-)/g));
					}

					if (addSpaces) {
						const spacedWords: string[] = [];
						for (let i = 0; i < words.length; i++) {
							spacedWords.push(words[i]);
							if (
								i < words.length - 1 &&
								!/\s$/.test(words[i]) &&
								!/^\s/.test(words[i + 1])
							) {
								spacedWords.push(" ");
							}
						}
						words = spacedWords;
					}
					
					line.words = words.map((word) => ({
						...newLyricWord(),
						word,
					}));
				}
			}




			if (enableEmptyBeat && emptyBeatSymbol.length > 0) {
				for (const line of result) {
					for (const word of line.words) {
						while (word.word.endsWith(emptyBeatSymbol)) {
							word.word = word.word.slice(0, -emptyBeatSymbol.length);
							word.emptyBeat += 1;
						}
					}
				}
			}

			store.set(lyricLinesAtom, {
				lyricLines: result,
				metadata: [],
			});
			if (result.length > 0) {
				store.set(selectedLinesAtom, new Set([result[0].id]));
				if (result[0].words.length > 0) {
					store.set(selectedWordsAtom, new Set([result[0].words[0].id]));
				}
			} else {
				store.set(selectedLinesAtom, new Set());
				store.set(selectedWordsAtom, new Set());
			}
			setImportFromTextDialog(false);
		},
		[store, setImportFromTextDialog],
	);


	return (
		<Dialog.Root
			open={importFromTextDialog}
			onOpenChange={setImportFromTextDialog}
		>
			<Dialog.Content maxWidth="1100px" maxHeight="90vh">
				<Tabs.Root
					defaultValue="import"
					style={{ display: "flex", flexDirection: "column", minHeight: "80vh" }}
					onValueChange={(val) => {
						if (val === "guide") setIsGuideClicked(true);
					}}
				>
					<Flex direction="column" gap="4">
						<Flex align="center" justify="between" pb="2" style={{ borderBottom: "1px solid var(--gray-5)" }}>
							<Dialog.Title style={{ marginBottom: 0 }}>
								{t("textImportDialog.title", "导入纯文本歌词")}
							</Dialog.Title>
							<Tabs.List size="2">
								<Tabs.Trigger value="import">
									{t("textImportDialog.tab.import", "Import")}
								</Tabs.Trigger>
								<Tabs.Trigger
									value="guide"
									className={!isGuideClicked ? styles.guideButtonFlash : undefined}
								>
									<Flex gap="1" align="center">
										<QuestionCircle16Regular />
										{t("textImportDialog.guides", "Guides")}
									</Flex>
								</Tabs.Trigger>
							</Tabs.List>
						</Flex>

						<Tabs.Content
							value="import"
						>
							<Flex direction="column" gap="4">
								<Flex justify="end" gap="2">
									<Button
										variant="soft"
										onClick={() =>
											window.open("https://lyrprep.spicylyrics.org/", "_blank")
										}
									>
										{t("textImportDialog.processLyrics", "Process Lyrics")}
									</Button>
									<Button
										onClick={() => {
											try {
												const importAction = () => {
													onImport(store.get(textValueAtom));
													setImportFromTextDialog(false);
												};
												if (isDirty)
													setConfirmDialog({
														open: true,
														title: t(
															"confirmDialog.importFile.title",
															"确认导入歌词",
														),
														description: t(
															"confirmDialog.importFile.description",
															"当前文件有未保存的更改。如果继续，这些更改将会丢失。确定要导入歌词吗？",
														),
														onConfirm: () => importAction(),
													});
												else importAction();
											} catch (e) {
												error(
													"导入纯文本歌词失败，请检查输入的文本是否正确，或者导入设置是否正确",
												);
												logError(e);
											}
										}}
									>
										{t("textImportDialog.actionButton", "导入歌词")}
									</Button>
								</Flex>
								<Flex
									gap="4"
									direction={{
										initial: "column",
										sm: "row",
									}}
								>
									<ImportFromTextEditor />
									<Grid
										columns="2"
										gapY="2"
										gapX="4"
										style={{
											whiteSpace: "nowrap",
											flex: "0 0 auto",
											alignItems: "center",
											alignContent: "start",
											textAlign: "end",
										}}
									>
										<PrefText>
											{t("textImportDialog.contentMode.caption", "导入模式")}
										</PrefText>
										<Select.Root
											value={importMode}
											onValueChange={(v) => setImportMode(v as ImportMode)}
										>
											<Select.Trigger /><Select.Content>
												<Select.Item value={ImportMode.Lyric}>
													{t("textImportDialog.contentMode.lyric", "仅歌词")}
												</Select.Item>
												<Select.Item value={ImportMode.LyricTrans}>
													{t(
														"textImportDialog.contentMode.withTranslation",
														"歌词和翻译歌词",
													)}
												</Select.Item>
												<Select.Item value={ImportMode.LyricRoman}>
													{t(
														"textImportDialog.contentMode.withRoman",
														"歌词和音译歌词",
													)}
												</Select.Item>
												<Select.Item value={ImportMode.LyricTransRoman}>
													{t(
														"textImportDialog.contentMode.withBoth",
														"歌词和翻译、音译歌词",
													)}
												</Select.Item>
											</Select.Content>
										</Select.Root>

										<PrefText>
											{t(
												"textImportDialog.separationMode.caption",
												"歌词分行（翻译和音译）模式",
											)}
										</PrefText>
										<Select.Root
											disabled={importMode === ImportMode.Lyric}
											value={lineSeparatorMode}
											onValueChange={(v) =>
												setLineSeparatorMode(v as LineSeparatorMode)
											}
										>
											<Select.Trigger /><Select.Content>
												<Select.Item value={LineSeparatorMode.Interleaved}>
													{t(
														"textImportDialog.separationMode.multipleLine",
														"多行交错分隔",
													)}
												</Select.Item>
												<Select.Item value={LineSeparatorMode.SameLineSeparator}>
													{t("textImportDialog.separationMode.sameLine", "同行分隔")}
												</Select.Item>
											</Select.Content>
										</Select.Root>

										<PrefText>
											{t("textImportDialog.separator", "歌词行分隔符")}
										</PrefText>
										<TextField.Root
											disabled={
												importMode === ImportMode.Lyric ||
												lineSeparatorMode !== LineSeparatorMode.SameLineSeparator
											}
											value={lineSeparator}
											onChange={(evt) => setLineSeparator(evt.currentTarget.value)}
										/>

										<PrefText>
											{t("textImportDialog.swapTransAndRoman", "交换翻译行和音译行")}
										</PrefText>
										<Switch
											checked={swapTransAndRoman}
											onCheckedChange={setSwapTransAndRoman}
										/>

										<PrefText>
											{t("textImportDialog.wordSeparator", "单词分隔符")}
										</PrefText>
										<TextField.Root
											value={wordSeparator}
											onChange={(evt) => setWordSeparator(evt.currentTarget.value)}
										/>

										<PrefText>
											{t("textImportDialog.addSpaces", "补全单词空格")}
										</PrefText>
										<Switch
											checked={addSpaces}
											onCheckedChange={setAddSpaces}
										/>

										<PrefText>
											{t("textImportDialog.splitHyphens", "拆分连字符单词")}
										</PrefText>
										<Switch
											checked={splitHyphens}
											onCheckedChange={setSplitHyphens}
										/>




										<PrefText>
											{t("textImportDialog.enableSpecialPrefix", "启用特殊前缀")}
										</PrefText>
										<Switch
											checked={enableSpecialPrefix}
											onCheckedChange={setEnableSpecialPrefix}
										/>

										<PrefText>
											{t("textImportDialog.bgLyricPrefix", "背景歌词前缀")}
										</PrefText>
										<TextField.Root
											disabled={!enableSpecialPrefix}
											value={bgLyricPrefix}
											onChange={(evt) => setBgLyricPrefix(evt.currentTarget.value)}
										/>

										<PrefText>
											{t("textImportDialog.duetLyricPrefix", "对唱歌词前缀")}
										</PrefText>
										<TextField.Root
											disabled={!enableSpecialPrefix}
											value={duetLyricPrefix}
											onChange={(evt) => setDuetLyricPrefix(evt.currentTarget.value)}
										/>

										<PrefText>
											{t("textImportDialog.enableEmptyBeat", "启用空拍")}
										</PrefText>
										<Switch
											checked={enableEmptyBeat}
											onCheckedChange={setEnableEmptyBeat}
										/>

										<PrefText>
											{t("textImportDialog.emptyBeatSymbol", "空拍符号")}
										</PrefText>
										<TextField.Root
											disabled={!enableEmptyBeat}
											value={emptyBeatSymbol}
											onChange={(evt) => setEmptyBeatSymbol(evt.currentTarget.value)}
										/>
									</Grid>
								</Flex>
							</Flex>
						</Tabs.Content>

						<Tabs.Content
							value="guide"
						>
							<ScrollArea scrollbars="vertical" style={{ height: "calc(80vh - 80px)" }}>
								<Flex direction="column" gap="4" p="4">
									<Card size="2">
										<Flex direction="column" gap="2">
											<Text size="5" weight="bold">{t("textImportDialog.guide.prepare.title", "1. 准备歌词")}</Text>
											<Text color="gray">
												{t("textImportDialog.guide.prepare.desc", "推荐使用 Lyrprep 工具来准备您的歌词。您可以搜索歌曲、选择版本并复制输出文本。")}
											</Text>
											<Button variant="soft" onClick={() => window.open("https://lyrprep.spicylyrics.org/", "_blank")}>
												<Open16Regular /> {t("textImportDialog.processLyrics", "Process Lyrics")}
											</Button>
										</Flex>
									</Card>

									<Card size="2">
										<Flex direction="column" gap="2">
											<Text size="5" weight="bold">{t("textImportDialog.guide.import.title", "2. 载入到脚本工具")}</Text>
											<Text color="gray">
												{t("textImportDialog.guide.import.desc", "将准备好的文本粘贴到左侧编辑器中。确保根据您的文本格式选择正确的“导入模式”。如果文本包含特殊前缀（如背景人声标识），请确保启用“特殊前缀”。")}
											</Text>
										</Flex>
									</Card>

									<Card size="2">
										<Flex direction="column" gap="2">
											<Text size="5" weight="bold">{t("textImportDialog.guide.sync.title", "3. 开始打轴")}</Text>
											<Text color="gray">
												{t("textImportDialog.guide.sync.desc", "点击“导入”后，切换到“打轴”模式（Time）。使用快捷键进行精准对齐：")}
											</Text>
											<Grid columns="2" gap="2">
												<Flex gap="2"><Badge color="blue">F</Badge><Text size="2">{t("textImportDialog.guide.sync.f", "设置单词开始时间")}</Text></Flex>
												<Flex gap="2"><Badge color="blue">G</Badge><Text size="2">{t("textImportDialog.guide.sync.g", "开启下一单词开始时间 (无停顿)")}</Text></Flex>
												<Flex gap="2"><Badge color="blue">H</Badge><Text size="2">{t("textImportDialog.guide.sync.h", "设置单词结束时间 (有停顿)")}</Text></Flex>
												<Flex gap="2"><Badge color="blue">A / D</Badge><Text size="2">{t("textImportDialog.guide.sync.ad", "在单词间切换")}</Text></Flex>
											</Grid>
										</Flex>
									</Card>

									<Card size="2">
										<Flex direction="column" gap="2">
											<Flex align="center" gap="2">
												<Text size="5" weight="bold">{t("textImportDialog.guide.community.title", "Community Guides & Cheat Sheets")}</Text>
												<Badge color="ruby">GENIUS</Badge>
											</Flex>
											<Text color="gray" size="2">
												{t("textImportDialog.guide.community.desc", "Helpful resources from the community for specific languages and genres.")}
											</Text>
											<Separator size="4" my="2" />
											<Grid columns={{ initial: "1", sm: "2" }} gap="2">
												{[
													{
														url: "https://genius.com/Kyelergenius-the-ultimate-ttml-maker-cheat-sheet-guide-annotated",
														description: "Kyeler's TTML Maker Guide",
														added_by: "NaeNae",
														featured: true,
													},
													{
														url: "https://genius.com/Opp-rap-slang-spelling-guide-annotated",
														description: "opp's Rap Slang Spelling Guide for Genius",
														added_by: "Toxi",
														featured: true,
													},
													{
														url: "https://genius.com/Riorson-rves-cheatsheet-annotated",
														description: "rves' Cheat Sheet for Genius",
														added_by: "NaeNae",
														featured: false,
													},
													{
														url: "https://genius.com/Housemusicfan1442-housemusicfan1442s-cheat-sheet-annotated",
														description: "HouseMusicFan1442's Cheat Sheet for Genius",
														added_by: "NaeNae",
														featured: false,
													},
													{
														url: "https://genius.com/Yznqq-yznqqs-german-cheat-sheet-annotated",
														description: "Yznqq’s German Cheat Sheet for Genius",
														added_by: "NaeNae",
														featured: false,
													},
													{
														url: "https://genius.com/Grafixal-genius-cheat-sheet-annotated",
														description: "grafiXal's Cheat Sheet for Genius",
														added_by: "NaeNae",
														featured: false,
													},
													{
														url: "https://genius.com/Vjthedj-vjthedjs-cheat-sheet-annotated",
														description: "VJtheDJ's Cheat Sheet for Genius",
														added_by: "NaeNae",
														featured: false,
													},
													{
														url: "https://genius.com/Zorro-kun-zorros-japan-song-cheat-sheet-annotated",
														description: "zorro’s Japanese Cheat Sheet for Genius",
														added_by: "NaeNae",
														featured: false,
													},
													{
														url: "https://genius.com/Jeiiy-vocaloid-cheat-sheet-annotated",
														description: "jelly's Vocaloid Cheat Sheet for Genius",
														added_by: "NaeNae",
														featured: false,
													},
													{
														url: "https://genius.com/artists/Community-guides",
														description: "Genius' Community Guides Page",
														added_by: "NaeNae",
														featured: false,
													},
												]
													.sort((a, b) => (b.featured ? 1 : 0) - (a.featured ? 1 : 0))
													.map((guide) => (
														<Button
															key={guide.url}
															variant={guide.featured ? "surface" : "soft"}
															color={guide.featured ? "ruby" : "gray"}
															onClick={() => window.open(guide.url, "_blank")}
															style={{ justifyContent: "start", textAlign: "left", height: "auto", padding: "8px 12px" }}
														>
															<Flex direction="column" gap="1" style={{ width: "100%" }}>
																<Flex align="center" gap="2">
																	<Open16Regular style={{ flexShrink: 0 }} />
																	<Text truncate size="1" weight="bold">
																		{guide.description}
																	</Text>
																	{guide.featured && (
																		<Badge size="1" color="ruby" style={{ marginLeft: "auto" }}>
																			Featured
																		</Badge>
																	)}
																</Flex>
																<Text size="1" color="gray" style={{ marginLeft: "20px", fontSize: "10px", opacity: 0.8 }}>
																	Added by {guide.added_by}
																</Text>
															</Flex>
														</Button>
													))}
											</Grid>
										</Flex>
									</Card>

									<Button variant="ghost" onClick={() => window.open("https://lyrprep.spicylyrics.org/guide/", "_blank")}>
										<Open16Regular /> {t("textImportDialog.guidesMenu.full", "Full TTML Guide")}
									</Button>
								</Flex>
							</ScrollArea>
						</Tabs.Content>
					</Flex>
				</Tabs.Root>
			</Dialog.Content>
		</Dialog.Root>
	);
};
