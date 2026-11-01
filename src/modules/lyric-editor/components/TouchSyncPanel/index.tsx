import { Button, Card, Grid } from "@radix-ui/themes";
import { useStore } from "jotai";
import type { FC, PointerEvent } from "react";
import { useTranslation } from "react-i18next";
import {
	keyMoveNextWordAtom,
	keyMovePrevWordAtom,
	keySyncEndAtom,
	keySyncNextAtom,
	keySyncStartAtom,
} from "$/states/keybindings.ts";
import {
	type atomWithKeybindingStorage,
	forceInvokeKeyBindingAtom,
} from "$/utils/keybindings.ts";
import styles from "./index.module.css";

type KeyBindingAtom = ReturnType<typeof atomWithKeybindingStorage>;

export const TouchSyncPanel: FC = () => {
	const store = useStore();
	const { t } = useTranslation();
	// One pointer handler covers mouse, pen and touch. Listening to both
	// mousedown and touchstart fired every tap twice, because the browser
	// follows a touch with synthesized mouse events.
	const pressProps = (action: KeyBindingAtom) => ({
		onPointerDown: (evt: PointerEvent<HTMLButtonElement>) => {
			if (evt.button !== 0) return;
			evt.preventDefault();
			forceInvokeKeyBindingAtom(store, action, evt.nativeEvent);
		},
	});
	return (
		<Card
			data-guide-target="touch-sync"
			m="2"
			mt="0"
			style={{ flexShrink: "0" }}
		>
			<Grid rows="2" columns="6" gap="2" className={styles.syncButtons}>
				<Button
					variant="soft"
					size="4"
					style={{ gridColumn: "span 3" }}
					{...pressProps(keyMovePrevWordAtom)}
				>
					{t("touchSyncPanel.prevWord", "Previous word")}
				</Button>
				<Button
					variant="soft"
					size="4"
					style={{ gridColumn: "span 3" }}
					{...pressProps(keyMoveNextWordAtom)}
				>
					{t("touchSyncPanel.nextWord", "Next word")}
				</Button>
				<Button
					variant="soft"
					size="4"
					style={{ gridColumn: "span 2" }}
					{...pressProps(keySyncStartAtom)}
				>
					{t("ribbonBar.syncMode.startSync", "Start")}
				</Button>
				<Button
					variant="soft"
					size="4"
					style={{ gridColumn: "span 2" }}
					{...pressProps(keySyncNextAtom)}
				>
					{t("ribbonBar.syncMode.continuousSync", "Next")}
				</Button>
				<Button
					variant="soft"
					size="4"
					style={{ gridColumn: "span 2" }}
					{...pressProps(keySyncEndAtom)}
				>
					{t("ribbonBar.syncMode.endSync", "End")}
				</Button>
			</Grid>
		</Card>
	);
};
