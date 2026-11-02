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

import { Button, Flex } from "@radix-ui/themes";
import { useSetAtom } from "jotai";
import { useTranslation } from "react-i18next";
import { ActionTooltip } from "$/components/ActionTooltip";
import { SlIcon } from "$/components/SlIcon";
import { romanizationPanelAtom } from "$/modules/romanization/states";
import { RibbonSection } from "../common";

/** Opens the Romanization panel, where all romanization happens. */
export const PhoneticSection = () => {
	const { t } = useTranslation();
	const openPanel = useSetAtom(romanizationPanelAtom);
	const label = t("romanizationPanel.open", "Romanization...");

	return (
		<RibbonSection
			label={
				<Flex gap="1" align="center">
					<SlIcon name="romanization" />
					{t("ribbonBar.editMode.romanization.section", "Romanization")}
				</Flex>
			}
		>
			<ActionTooltip
				label={label}
				description={t(
					"romanizationPanel.tooltip",
					"Fill romanization for the whole song or the selected lines, automatically or from a romanized lyric page.",
				)}
			>
				<Button size="1" variant="soft" onClick={() => openPanel(true)}>
					{label}
				</Button>
			</ActionTooltip>
		</RibbonSection>
	);
};
