import {
	ArrowSortDownLines24Regular,
	Speaker224Regular,
	Stack24Regular,
	TextT24Regular,
	Window24Regular,
} from "@fluentui/react-icons";
import { Box, Card, Flex, Heading, Text } from "@radix-ui/themes";
import { Reorder } from "framer-motion";
import { RibbonCustomizeSettingRow } from "$/components/RibbonBar/customize/RibbonCustomizeSettingRow";
import type { AppearanceSectionState } from "./sectionState";
export const LayoutSection = ({
	layoutOrder,
	setLayoutOrder,
	t,
}: Pick<AppearanceSectionState, "layoutOrder" | "setLayoutOrder" | "t">) => (
	<Flex direction="column" gap="3">
		<Heading size="4">
			<ArrowSortDownLines24Regular />{" "}
			{t("settings.appearance.layout.title", "Application layout")}
		</Heading>
		<Card>
			<Flex direction="column" gap="4">
				<Flex direction="column" gap="1">
					<Text weight="bold">
						{t("settings.appearance.layout.order", "Element order")}
					</Text>
					<Text size="1" color="gray">
						{t(
							"settings.appearance.layout.orderDesc",
							"Drag to reorder elements. Some positions may be limited by constraints.",
						)}
					</Text>
				</Flex>

				<Reorder.Group
					axis="y"
					values={layoutOrder}
					onReorder={setLayoutOrder}
					style={{
						display: "flex",
						flexDirection: "column",
						gap: "8px",
						listStyle: "none",
						padding: 0,
					}}
				>
					{layoutOrder.map((item) => (
						<Reorder.Item key={item} value={item} style={{ cursor: "grab" }}>
							<Card size="1">
								<Flex align="center" gap="3">
									<Stack24Regular style={{ color: "var(--gray-8)" }} />
									<Box flexGrow="1">
										<Text size="2" weight="bold">
											{item === "titlebar" && (
												<>
													<Window24Regular />{" "}
													{t(
														"settings.appearance.layout.titlebar",
														"Title bar",
													)}
												</>
											)}
											{item === "ribbonbar" && (
												<>
													<Stack24Regular
														style={{ transform: "rotate(180deg)" }}
													/>{" "}
													{t(
														"settings.appearance.layout.ribbonbar",
														"Toolbar (ribbon)",
													)}
												</>
											)}
											{item === "editor" && (
												<>
													<TextT24Regular />{" "}
													{t(
														"settings.appearance.layout.editor",
														"Main editor area",
													)}
												</>
											)}
											{item === "audio-controls" && (
												<>
													<Speaker224Regular />{" "}
													{t(
														"settings.appearance.layout.audio",
														"Audio controls",
													)}
												</>
											)}
										</Text>
									</Box>
								</Flex>
							</Card>
						</Reorder.Item>
					))}
				</Reorder.Group>
				<RibbonCustomizeSettingRow />
			</Flex>
		</Card>
	</Flex>
);
