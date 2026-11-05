import { ErrorCircle16Regular } from "@fluentui/react-icons";
import { Flex, Text } from "@radix-ui/themes";
import type { ReactNode } from "react";

/**
 * An error shown where it happened. Use it over a toast when the message holds
 * a link or sits in a dialog, since toasts render behind and outside dialogs.
 * `action` sits outside the red text, so a link keeps the accent color.
 */
export function InlineAlert({
	children,
	action,
}: {
	children: ReactNode;
	action?: ReactNode;
}) {
	return (
		<Flex gap="2" align="start" role="alert">
			<Text color="red" asChild>
				<ErrorCircle16Regular aria-hidden style={{ flexShrink: 0 }} />
			</Text>
			<Flex direction="column" gap="1" align="start">
				<Text size="2" color="red">
					{children}
				</Text>
				{action}
			</Flex>
		</Flex>
	);
}
