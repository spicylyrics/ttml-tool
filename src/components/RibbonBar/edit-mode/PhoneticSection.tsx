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

import { QuestionCircle16Regular } from "@fluentui/react-icons";
import {
	Button,
	Flex,
	Grid,
	IconButton,
	Popover,
	Select,
	Spinner,
	Switch,
	Text,
} from "@radix-ui/themes";
import { ActionTooltip } from "$/components/ActionTooltip";
import { SlIcon } from "$/components/SlIcon";
import { displayRomanizationInSyncAtom } from "$/modules/settings/states/index.ts";
import { RibbonSection } from "../common";

import { usePhoneticSection } from "./usePhoneticSection";
export const PhoneticSection = () => {
	const {
		t,
		lang,
		setLang,
		loading,
		handleAutoFetch,
		displayRomanization,
		store,
	} = usePhoneticSection();
	const aboutLabel = t(
		"ribbonBar.editMode.romanization.info.title",
		"About romanization",
	);
	const languageLabel = t(
		"ribbonBar.tooltips.romanizationLanguage",
		"Romanization language",
	);
	const showRomanizationLabel = t(
		"ribbonBar.syncMode.showPerWordRomanization",
		"Show per-word romanization",
	);
	const showRomanizationDescription = t(
		"settings.workflow.showPerWordRomanizationDesc",
		"Show each word's romanization under it.",
	);

	return (
		<RibbonSection
			label={
				<Flex gap="1" align="center">
					<SlIcon name="romanization" />
					{t("ribbonBar.editMode.romanization.section", "Romanization")}
					<Popover.Root>
						<ActionTooltip label={aboutLabel}>
							<Popover.Trigger>
								<IconButton
									size="1"
									variant="ghost"
									style={{ cursor: "pointer" }}
									aria-label={aboutLabel}
								>
									<QuestionCircle16Regular />
								</IconButton>
							</Popover.Trigger>
						</ActionTooltip>
						<Popover.Content size="1" style={{ width: 300 }}>
							<Flex direction="column" gap="2">
								<Text size="2" weight="bold">
									{aboutLabel}
								</Text>
								<Text size="1">
									{t(
										"ribbonBar.editMode.romanization.info.canDo",
										"✓ Can do: Japanese romaji, Mandarin pinyin, Cantonese jyutping and Korean romanization, including kanji.",
									)}
								</Text>
								<Text size="1">
									{t(
										"ribbonBar.editMode.romanization.info.cannotDo",
										"✗ Can't do: guarantee rare kanji or names are right. CJK only, so expect small mistakes.",
									)}
								</Text>
							</Flex>
						</Popover.Content>
					</Popover.Root>
				</Flex>
			}
		>
			<Grid columns="2" gap="2" align="center">
				<Select.Root
					value={lang}
					onValueChange={(v) => {
						if (
							v === "auto" ||
							v === "ja" ||
							v === "zh" ||
							v === "ko" ||
							v === "yue"
						) {
							setLang(v);
						}
					}}
					size="1"
				>
					<ActionTooltip
						label={languageLabel}
						description={t(
							"ribbonBar.tooltips.romanizationLanguageDesc",
							"The language the selected lyrics are in. Auto-detect works for most songs.",
						)}
					>
						<Select.Trigger aria-label={languageLabel} />
					</ActionTooltip>
					<Select.Content>
						<Select.Item value="auto">
							{t("common.autoDetect", "Auto-detect")}
						</Select.Item>
						<Select.Item value="ja">
							{t("ribbonBar.editMode.romanization.ja", "Japanese (Romaji)")}
						</Select.Item>
						<Select.Item value="zh">
							{t("ribbonBar.editMode.romanization.zh", "Chinese (Pinyin)")}
						</Select.Item>
						<Select.Item value="yue">
							{t("ribbonBar.editMode.romanization.yue", "Cantonese (Jyutping)")}
						</Select.Item>
						<Select.Item value="ko">
							{t(
								"ribbonBar.editMode.romanization.ko",
								"Korean (Revised Romanization)",
							)}
						</Select.Item>
					</Select.Content>
				</Select.Root>
				<ActionTooltip
					label={t("ribbonBar.editMode.romanization.autoFetch", "Romanize")}
					description={t(
						"ribbonBar.tooltips.romanize",
						"Fill in romanization for the selected lines or words.",
					)}
				>
					<Button
						size="1"
						variant="soft"
						onClick={handleAutoFetch}
						disabled={loading}
					>
						{loading ? (
							<Spinner size="1" />
						) : (
							t("ribbonBar.editMode.romanization.autoFetch", "Romanize")
						)}
					</Button>
				</ActionTooltip>
				<Flex style={{ gridColumn: "span 2", justifyContent: "center" }}>
					<ActionTooltip
						label={showRomanizationLabel}
						description={showRomanizationDescription}
					>
						<Flex gap="2" align="center">
							<Text size="1" color="gray">
								{t("settings.common.enabled", "Enabled")}
							</Text>
							<Switch
								size="1"
								checked={displayRomanization}
								onCheckedChange={(checked) =>
									store.set(displayRomanizationInSyncAtom, checked)
								}
								aria-label={showRomanizationLabel}
							/>
						</Flex>
					</ActionTooltip>
				</Flex>
			</Grid>
		</RibbonSection>
	);
};
