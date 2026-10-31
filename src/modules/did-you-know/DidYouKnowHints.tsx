import { Button, Flex, Kbd, Text } from "@radix-ui/themes";
import { useAtomValue, useStore } from "jotai";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "react-toastify";
import { audioPlayingAtom } from "$/modules/audio/states";
import { cmdDuplicatePaste } from "$/modules/keyboard/commands";
import { lyricLinesAtom, ToolMode, toolModeAtom } from "$/states/main";
import { formatKeyBindings } from "$/utils/keybindings";
import {
	decideHint,
	type EditorSnapshot,
	HINT_IDS,
	type HintId,
	initialRepeatedSectionState,
	initialSplitTripState,
	stepRepeatedSection,
	stepSplitTrip,
} from "./detectors";
import {
	didYouKnowEnabledAtom,
	didYouKnowShownAtom,
	TIPS_RELEASED,
} from "./states";

// At most one hint per app session, across remounts.
let shownThisSession = false;

const isMac = () => navigator.userAgent.includes("Mac");

/**
 * Watches the editor and shows one small tip the first time someone does
 * something the slow way. Renders nothing; does nothing while the flag is off.
 */
export const DidYouKnowHints = () => {
	const store = useStore();
	const enabled = useAtomValue(didYouKnowEnabledAtom);
	const { t } = useTranslation();

	useEffect(() => {
		if (!TIPS_RELEASED || !enabled || shownThisSession) return;
		const alreadyShown = store.get(didYouKnowShownAtom);
		if (HINT_IDS.every((id) => alreadyShown.includes(id))) return;

		const readSnapshot = (): EditorSnapshot => ({
			mode: store.get(toolModeAtom),
			lines: store.get(lyricLinesAtom).lyricLines,
		});
		const isSyncing = () =>
			store.get(toolModeAtom) === ToolMode.Sync && store.get(audioPlayingAtom);

		let snapshot = readSnapshot();
		let repeated = initialRepeatedSectionState();
		let splitTrip = initialSplitTripState();
		let pending: HintId | null = null;

		const message = (id: HintId) => {
			if (id === "repeatedSection") {
				const keys = store.get(cmdDuplicatePaste.atom);
				return {
					text: t(
						"didYouKnow.repeatedSection",
						"Repeated lines can reuse earlier timing. Select the earlier lines, put the playhead where the repeat starts, and use Duplicate at playhead.",
					),
					shortcut: keys ? formatKeyBindings(keys) : null,
				};
			}
			return {
				text: t(
					"didYouKnow.splitInTimeMode",
					"You can split a word without leaving Time mode: hold {modifier} and double-click it.",
					{ modifier: formatKeyBindings([isMac() ? "Meta" : "Control"]) },
				),
				shortcut: null,
			};
		};

		const show = (id: HintId) => {
			shownThisSession = true;
			pending = null;
			// Nothing else can show this session, so stop watching edits.
			unsubscribeAll();
			store.set(didYouKnowShownAtom, (shown) => [...shown, id]);
			const { text, shortcut } = message(id);
			toast.info(
				({ closeToast }) => (
					<Flex direction="column" gap="2">
						<Text size="2" weight="medium">
							{t("didYouKnow.title", "Did you know?")}
						</Text>
						<Text size="2">
							{text}
							{shortcut && (
								<>
									{" "}
									<Kbd>{shortcut}</Kbd>
								</>
							)}
						</Text>
						<Flex justify="end">
							<Button
								size="1"
								variant="ghost"
								color="gray"
								onClick={() => {
									store.set(didYouKnowEnabledAtom, false);
									closeToast();
								}}
							>
								{t("didYouKnow.turnOff", "Don't show tips")}
							</Button>
						</Flex>
					</Flex>
				),
				{
					toastId: `did-you-know-${id}`,
					autoClose: 15000,
					closeOnClick: false,
				},
			);
		};

		const offer = (id: HintId) => {
			const decision = decideHint(id, {
				enabled: store.get(didYouKnowEnabledAtom),
				shown: store.get(didYouKnowShownAtom),
				shownThisSession,
				syncing: isSyncing(),
			});
			if (decision === "show") show(id);
			else if (decision === "defer") pending = id;
		};

		const flushPending = () => {
			if (pending) offer(pending);
		};

		const onEditorChange = () => {
			const next = readSnapshot();
			if (next.mode === snapshot.mode && next.lines === snapshot.lines) return;
			const prev = snapshot;
			snapshot = next;
			if (shownThisSession || pending) return;

			const shown = store.get(didYouKnowShownAtom);
			if (!shown.includes("repeatedSection")) {
				const result = stepRepeatedSection(repeated, prev, next);
				repeated = result.state;
				if (result.fire) offer("repeatedSection");
			}
			if (!pending && !shown.includes("splitInTimeMode")) {
				const result = stepSplitTrip(splitTrip, prev, next);
				splitTrip = result.state;
				if (result.fire) offer("splitInTimeMode");
			}
		};

		const unsubscribers = [
			store.sub(lyricLinesAtom, onEditorChange),
			store.sub(toolModeAtom, () => {
				onEditorChange();
				flushPending();
			}),
			store.sub(audioPlayingAtom, flushPending),
		];
		function unsubscribeAll() {
			for (const unsubscribe of unsubscribers.splice(0)) unsubscribe();
		}
		return unsubscribeAll;
	}, [enabled, store, t]);

	return null;
};
