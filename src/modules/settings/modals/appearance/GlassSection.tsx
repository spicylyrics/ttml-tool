import { Sparkle24Regular } from "@fluentui/react-icons";
import { Box, Card, Flex, Heading, Slider, Text } from "@radix-ui/themes";
import { MAX_GLASS_BLUR } from "$/modules/settings/logic/glass-blur";
import type { AppearanceSectionState } from "./sectionState";
export const GlassSection = ({
	glassBlur,
	setGlassBlur,
	t,
}: Pick<AppearanceSectionState, "glassBlur" | "setGlassBlur" | "t">) => (
	<>
		<Heading size="4" mt="4">
			{t("settings.appearance.glass", "Glassmorphism")}
		</Heading>
		<Card>
			<Flex direction="column" gap="4">
				<Flex gap="3" align="start">
					<Sparkle24Regular />
					<Box flexGrow="1">
						<Flex direction="column" gap="3">
							<Flex align="center" justify="between">
								<Flex direction="column" gap="1">
									<Text>
										{t("settings.appearance.glassBlur", "Glass intensity")}
									</Text>
									<Text size="1" color="gray">
										{t(
											"settings.appearance.glassBlurDesc",
											"Adjust the background blur effect for glassmorphic elements.",
										)}
									</Text>
								</Flex>
								<Text
									size="1"
									weight="bold"
									style={{ color: "var(--accent-11)" }}
								>
									{glassBlur}px
								</Text>
							</Flex>
							<Slider
								min={0}
								max={MAX_GLASS_BLUR}
								step={1}
								value={[glassBlur]}
								onValueChange={(v) => {
									setGlassBlur(v[0]);
								}}
							/>
						</Flex>
					</Box>
				</Flex>
			</Flex>
		</Card>
	</>
);
