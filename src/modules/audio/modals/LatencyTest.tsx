import {
	Button,
	Dialog,
	Flex,
	Switch,
	Text,
	TextField,
} from "@radix-ui/themes";
import { useAtom, useAtomValue } from "jotai";
import { memo, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KeyBinding } from "$/components/KeyBinding";
import { audioEngine } from "$/modules/audio/audio-engine";
import { calculateSyncTime } from "$/modules/lyric-editor/utils/sync-timing";
import {
	latencyTestBPMAtom,
	syncJudgeModeAtom,
} from "$/modules/settings/states";
import { syncTimeOffsetAtom } from "$/modules/settings/states/sync";
import { latencyTestDialogAtom } from "$/states/dialogs.ts";
import { keySyncNextAtom } from "$/states/keybindings";
import { type KeyBindingEvent, registerKeyBindings } from "$/utils/keybindings";
import {
	getLatencyStatistics,
	subscribeLatencyTestTaps,
} from "../utils/latency-test-session";
import styles from "./LatencyTest.module.css";

const isValidBPM = (value: unknown): value is number =>
	typeof value === "number" &&
	Number.isFinite(value) &&
	value >= 60 &&
	value <= 320;

export const LatencyTestDialog = memo(() => {
	const { t } = useTranslation();
	const [dialogOpen, setDialogOpen] = useAtom(latencyTestDialogAtom);
	const [storedBPM, setLatencyBPM] = useAtom(latencyTestBPMAtom);
	// Older builds could store NaN (saved as null) when the field was cleared.
	const latencyBPM = isValidBPM(storedBPM) ? storedBPM : 120;
	const [bpmDraft, setBpmDraft] = useState(String(latencyBPM));
	const [start, setStart] = useState(false);
	const [useOffset, setUseOffset] = useState(false);
	const [syncTimeOffset, setSyncTimeOffset] = useAtom(syncTimeOffsetAtom);
	const [trialOffset, setTrialOffset] = useState(String(syncTimeOffset));
	const parsedOffset = Number(trialOffset);
	const validOffset =
		trialOffset.trim() !== "" && Number.isSafeInteger(parsedOffset);
	const appliedOffset = useOffset && validOffset ? parsedOffset : 0;
	const [curBeat, setCurBeat] = useState(-1);
	const [samples, setSamples] = useState<number[]>([]);
	const statistics =
		useOffset && !validOffset
			? null
			: getLatencyStatistics(samples, appliedOffset);
	const syncJudgeMode = useAtomValue(syncJudgeModeAtom);
	const syncNextBinding = useAtomValue(keySyncNextAtom);
	const nextBeatTime = useRef(0);
	const curBeatTime = useRef(0);
	const hitOffsetsRef = useRef<number[]>([]);
	const beepDuration = 1000 / (latencyBPM / 60);
	const recommendedOffset = statistics?.recommendedOffset;
	const timingLabel = (value: number) =>
		t(
			value > 0
				? "latencyTestDialog.latencyDisplay.current.fast"
				: value < 0
					? "latencyTestDialog.latencyDisplay.current.slow"
					: "latencyTestDialog.latencyDisplay.current.perfect",
		);

	useEffect(() => {
		if (dialogOpen) setTrialOffset(String(syncTimeOffset));
	}, [dialogOpen, syncTimeOffset]);

	useEffect(() => {
		if (dialogOpen) return;
		setStart(false);
		setSamples([]);
		hitOffsetsRef.current = [];
		curBeatTime.current = 0;
		nextBeatTime.current = 0;
	}, [dialogOpen]);

	useEffect(() => {
		if (!start || !dialogOpen) {
			setCurBeat(-1);
			return;
		}
		setSamples([]);
		hitOffsetsRef.current = [];
		let canceled = false;
		let frameId = 0;
		const scheduledNodes = new Set<AudioScheduledSourceNode>();
		const playBeep = (
			node: AudioScheduledSourceNode,
			when: number,
			stop: number,
		) => {
			node.addEventListener("ended", () => scheduledNodes.delete(node), {
				once: true,
			});
			void audioEngine.playNode(node, when, stop).then(() => {
				if (canceled) node.stop();
				else scheduledNodes.add(node);
			});
		};
		(async () => {
			const beep = (frequency: number) => {
				const node = audioEngine.ctx.createOscillator();
				node.type = "sine";
				node.frequency.value = frequency;
				return node;
			};
			let beat = 0;
			const dur = beepDuration / 1000;
			const nodeDur = 0.05;
			curBeatTime.current = audioEngine.ctxCurrentTime;
			nextBeatTime.current = curBeatTime.current;
			playBeep(beep(880), curBeatTime.current, curBeatTime.current + nodeDur);
			setCurBeat(0);
			while (!canceled) {
				const currentTime = audioEngine.ctxCurrentTime;
				if (currentTime >= nextBeatTime.current) {
					setCurBeat(beat);
					const node = beep(++beat % 4 === 0 ? 880 : 440);
					beat %= 4;
					curBeatTime.current = nextBeatTime.current;
					nextBeatTime.current = currentTime + dur;
					playBeep(node, nextBeatTime.current, nextBeatTime.current + nodeDur);
				}
				await new Promise<void>((resolve) => {
					frameId = requestAnimationFrame(() => resolve());
				});
			}
		})();
		return () => {
			canceled = true;
			cancelAnimationFrame(frameId);
			for (const node of scheduledNodes) node.stop();
			scheduledNodes.clear();
		};
	}, [start, dialogOpen, beepDuration]);

	useEffect(() => {
		const onTap = (evt: KeyBindingEvent) => {
			// Judge the tap exactly like a sync stamp: on the audible clock, with the
			// same key and processing-delay handling, so the recommendation matches.
			const hitTime =
				calculateSyncTime({
					audioTimeSeconds: audioEngine.audibleContextTime,
					playbackRate: 1,
					isPlaying: true,
					event: evt,
					judgeMode: syncJudgeMode,
					syncTimeOffset: 0,
					performanceTime: performance.now(),
					performanceTimeOrigin: performance.timeOrigin,
				}) / 1000;
			const curDiff = curBeatTime.current - hitTime;
			const nextDiff = nextBeatTime.current - hitTime;
			const diff = Math.abs(curDiff) < Math.abs(nextDiff) ? curDiff : nextDiff;
			hitOffsetsRef.current = [...hitOffsetsRef.current.slice(-99), diff];
			setSamples(hitOffsetsRef.current);
		};
		return subscribeLatencyTestTaps(
			dialogOpen && start,
			(callback) => registerKeyBindings(syncNextBinding, callback),
			onTap,
		);
	}, [dialogOpen, start, syncJudgeMode, syncNextBinding]);

	return (
		<Dialog.Root open={dialogOpen} onOpenChange={setDialogOpen}>
			<Dialog.Content maxWidth="520px" className={styles.dialog}>
				<Dialog.Title mb="2">{t("latencyTestDialog.title")}</Dialog.Title>
				<Dialog.Description size="2" color="gray" mb="5">
					{t("latencyTestDialog.description", {
						key: <KeyBinding kbdAtom={keySyncNextAtom} />,
					})}
				</Dialog.Description>

				<div className={styles.transport}>
					<div className={styles.beats} aria-hidden="true">
						{[0, 1, 2, 3].map((beat) => (
							<span
								key={beat}
								className={styles.beat}
								data-active={curBeat === beat}
							/>
						))}
					</div>
					<Flex gap="3" align="center">
						<Text as="label" size="1" color="gray" className={styles.tempo}>
							{t("latencyTestDialog.bpmInputLabel")}
							<TextField.Root
								type="number"
								min={60}
								max={320}
								value={bpmDraft}
								size="2"
								onChange={(event) => {
									setBpmDraft(event.target.value);
									const value = event.target.valueAsNumber;
									if (isValidBPM(value)) setLatencyBPM(value);
								}}
								onBlur={() => setBpmDraft(String(latencyBPM))}
							/>
						</Text>
						<Button
							onClick={() => setStart((value) => !value)}
							className={styles.start}
						>
							{t(
								start
									? "latencyTestDialog.button.stop"
									: "latencyTestDialog.button.start",
							)}
						</Button>
					</Flex>
				</div>

				<section
					className={styles.measurement}
					aria-label={t("latencyTestDialog.title")}
				>
					<div className={styles.current}>
						<span className={styles.value}>
							{statistics ? `${Math.abs(statistics.current)}` : "..."}
							<span className={styles.unit}> ms</span>
						</span>
						<Text size="2" color="gray">
							{statistics
								? timingLabel(statistics.current)
								: t("latencyTestDialog.latencyDisplay.current.none")}
						</Text>
					</div>
					<div className={styles.plot} aria-hidden="true">
						<span className={styles.zero} />
						{statistics &&
							samples.map((sample, index) => (
								<span
									key={`${index}:${sample}`}
									className={styles.tap}
									style={{
										left: `${Math.max(0, Math.min(100, 50 - ((sample * 1000 - appliedOffset) / beepDuration) * 100))}%`,
									}}
								/>
							))}
					</div>
					<div className={styles.plotLabels} aria-hidden="true">
						<span>{t("latencyTestDialog.latencyDisplay.current.fast")}</span>
						<span>0 ms</span>
						<span>{t("latencyTestDialog.latencyDisplay.current.slow")}</span>
					</div>
					<dl className={styles.range}>
						<div>
							<dt>{t("latencyTestDialog.latencyDisplay.fastest")}</dt>
							<dd>
								{statistics
									? `${timingLabel(statistics.max)} ${Math.abs(statistics.max)} ms`
									: "..."}
							</dd>
						</div>
						<div>
							<dt>{t("latencyTestDialog.latencyDisplay.slowest")}</dt>
							<dd>
								{statistics
									? `${timingLabel(statistics.min)} ${Math.abs(statistics.min)} ms`
									: "..."}
							</dd>
						</div>
					</dl>
					{statistics && (
						<Text as="p" size="1" color="gray" className={styles.precision}>
							{t("latencyTestDialog.precision", {
								count: statistics.count,
								error: statistics.meanAbsoluteError,
							})}
						</Text>
					)}
				</section>

				<div>
					<div className={styles.offsetRow}>
						<Text as="label" size="2" weight="medium">
							<Flex gap="2" align="center">
								<Switch checked={useOffset} onCheckedChange={setUseOffset} />
								{t("latencyTestDialog.useOffset")}
							</Flex>
						</Text>
						<Flex gap="2" align="center">
							<TextField.Root
								type="number"
								step={1}
								value={trialOffset}
								aria-label={t("settings.common.syncTimeOffset")}
								aria-invalid={!validOffset}
								className={styles.offsetInput}
								onChange={(event) => setTrialOffset(event.target.value)}
							>
								<TextField.Slot side="right">ms</TextField.Slot>
							</TextField.Root>
							<Button
								variant="outline"
								disabled={!validOffset || parsedOffset === syncTimeOffset}
								onClick={() => setSyncTimeOffset(parsedOffset)}
							>
								{t("latencyTestDialog.saveOffset")}
							</Button>
						</Flex>
					</div>
					<Text
						as="p"
						size="1"
						color={validOffset ? "gray" : "red"}
						role="status"
						className={styles.hint}
					>
						{!validOffset
							? t("latencyTestDialog.invalidOffset")
							: useOffset
								? t("latencyTestDialog.offsetNotice", { offset: appliedOffset })
								: t("latencyTestDialog.trialOffsetHint")}
					</Text>
				</div>

				<div className={styles.recommendation}>
					<Text
						size="2"
						weight={recommendedOffset != null ? "medium" : "regular"}
						color={recommendedOffset != null ? undefined : "gray"}
					>
						{/* Announce the recommendation, not the tap count on every beat. */}
						<span role="status">
							{recommendedOffset != null &&
								t("latencyTestDialog.recommendedOffset", {
									offset: recommendedOffset,
								})}
						</span>
						{recommendedOffset == null &&
							t("latencyTestDialog.recommendationProgress", {
								count: samples.length,
							})}
					</Text>
					{recommendedOffset != null && (
						<Button
							variant="soft"
							size="2"
							disabled={useOffset && parsedOffset === recommendedOffset}
							onClick={() => {
								setTrialOffset(String(recommendedOffset));
								setUseOffset(true);
							}}
						>
							{t("latencyTestDialog.tryRecommendation")}
						</Button>
					)}
				</div>
			</Dialog.Content>
		</Dialog.Root>
	);
});
