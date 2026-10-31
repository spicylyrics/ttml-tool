import { invoke } from "@tauri-apps/api/core";
import { useAtomValue, useStore } from "jotai";
import { useCallback, useEffect, useRef, useState } from "react";
import { audioEngine } from "$/modules/audio/audio-engine";
import { audioPlayingAtom, playbackRateAtom } from "$/modules/audio/states";
import {
	discordDetailsTemplateAtom,
	discordIdleTimeoutMinutesAtom,
	discordPlaybackTimelineAtom,
	discordProjectElapsedAtom,
	discordRepositoryButtonAtom,
	discordRichPresenceEnabledAtom,
	discordStateTemplateAtom,
	discordStatusBadgeAtom,
} from "$/modules/settings/states";
import {
	lyricLinesAtom,
	lyricMetadataAtom,
	projectIdAtom,
	saveFileNameAtom,
	selectedLinesAtom,
	selectedWordsAtom,
	toolModeAtom,
} from "$/states/main";
import { log } from "$/utils/logging";
import { InactivityTimer, shouldResetInactivity } from "./inactivity";
import {
	createDiscordTemplateContext,
	createInactiveDiscordActivity,
	createPresenceSnapshot,
	DEFAULT_DISCORD_DETAILS_TEMPLATE,
	DEFAULT_DISCORD_STATE_TEMPLATE,
	formatNativeDiscordActivity,
	PRESENCE_META_NAME,
	validateDiscordTemplate,
} from "./presence";
import { ProjectTimeTracker } from "./project-time";

const isTauri = Boolean(import.meta.env.TAURI_ENV_PLATFORM);

export function DiscordPresence() {
	const store = useStore();
	const metadata = useAtomValue(lyricMetadataAtom);
	const fileName = useAtomValue(saveFileNameAtom);
	const mode = useAtomValue(toolModeAtom);
	const playing = useAtomValue(audioPlayingAtom);
	const playbackRate = useAtomValue(playbackRateAtom);
	const enabled = useAtomValue(discordRichPresenceEnabledAtom);
	const detailsTemplate = useAtomValue(discordDetailsTemplateAtom);
	const stateTemplate = useAtomValue(discordStateTemplateAtom);
	const showPlaybackTimeline = useAtomValue(discordPlaybackTimelineAtom);
	const showProjectElapsed = useAtomValue(discordProjectElapsedAtom);
	const showRepositoryButton = useAtomValue(discordRepositoryButtonAtom);
	const showStatusBadge = useAtomValue(discordStatusBadgeAtom);
	const idleTimeoutMinutes = useAtomValue(discordIdleTimeoutMinutesAtom);
	const projectId = useAtomValue(projectIdAtom);
	const [inactive, setInactive] = useState(false);
	const nativeUpdateInFlight = useRef(false);
	const lastNativePayload = useRef<string | null>(null);
	const nativeEpoch = useRef(0);
	const trackerRef = useRef<ProjectTimeTracker | null>(null);
	if (!trackerRef.current) {
		trackerRef.current = new ProjectTimeTracker(window.localStorage);
	}
	const tracker = trackerRef.current;

	useEffect(() => {
		if (!isTauri) return;
		const timeoutMinutes = Math.min(60, Math.max(1, idleTimeoutMinutes));
		const timer = new InactivityTimer(
			timeoutMinutes * 60_000,
			(nextInactive) => {
				tracker.setPaused(nextInactive);
				setInactive(nextInactive);
			},
		);
		const markActivity = (event: Event) => {
			if (!shouldResetInactivity(event.isTrusted, document.visibilityState))
				return;
			timer.activity();
		};
		const markFocused = (event: Event) => markActivity(event);
		const eventOptions = { passive: true } as const;
		window.addEventListener("keydown", markActivity);
		window.addEventListener("pointerdown", markActivity, eventOptions);
		window.addEventListener("touchstart", markActivity, eventOptions);
		window.addEventListener("wheel", markActivity, eventOptions);
		window.addEventListener("focus", markFocused);
		timer.start();
		return () => {
			timer.stop();
			window.removeEventListener("keydown", markActivity);
			window.removeEventListener("pointerdown", markActivity);
			window.removeEventListener("touchstart", markActivity);
			window.removeEventListener("wheel", markActivity);
			window.removeEventListener("focus", markFocused);
		};
	}, [idleTimeoutMinutes, tracker]);

	useEffect(() => {
		tracker.switchProject(projectId);
		const flush = () => tracker.flush();
		const timer = window.setInterval(flush, 10_000);
		window.addEventListener("pagehide", flush);
		return () => {
			window.clearInterval(timer);
			window.removeEventListener("pagehide", flush);
			flush();
		};
	}, [projectId, tracker]);

	const publish = useCallback(() => {
		const lyrics = { ...store.get(lyricLinesAtom), metadata };
		const selectedLineIds = store.get(selectedLinesAtom);
		const selectedWordIds = store.get(selectedWordsAtom);
		const snapshot = createPresenceSnapshot({
			lyrics,
			fileName,
			mode,
			selectedLineIds,
			playing,
			positionSeconds: audioEngine.musicCurrentTime,
			durationSeconds: audioEngine.musicDuration,
			playbackRate,
			projectElapsedSeconds: tracker.getElapsedSeconds(projectId),
		});

		let meta = document.head.querySelector<HTMLMetaElement>(
			`meta[name="${PRESENCE_META_NAME}"]`,
		);
		if (!meta) {
			meta = document.createElement("meta");
			meta.name = PRESENCE_META_NAME;
			document.head.append(meta);
		}
		const content = JSON.stringify(snapshot);
		if (meta.content !== content) meta.content = content;

		if (isTauri && enabled) {
			const safeDetailsTemplate = validateDiscordTemplate(detailsTemplate)
				? DEFAULT_DISCORD_DETAILS_TEMPLATE
				: detailsTemplate;
			const safeStateTemplate = validateDiscordTemplate(stateTemplate)
				? DEFAULT_DISCORD_STATE_TEMPLATE
				: stateTemplate;
			const context = createDiscordTemplateContext({
				snapshot,
				lyrics,
				fileName,
				selectedLineIds,
				selectedWordIds,
			});
			const payload = inactive
				? createInactiveDiscordActivity()
				: formatNativeDiscordActivity(snapshot, context, {
						detailsTemplate: safeDetailsTemplate,
						stateTemplate: safeStateTemplate,
						showPlaybackTimeline,
						showProjectElapsed,
						showRepositoryButton,
						showStatusBadge,
					});
			const key = JSON.stringify(payload);
			if (nativeUpdateInFlight.current || lastNativePayload.current === key)
				return;
			nativeUpdateInFlight.current = true;
			const epoch = nativeEpoch.current;
			invoke("set_discord_activity", { payload })
				.then(() => {
					if (nativeEpoch.current === epoch) lastNativePayload.current = key;
				})
				.catch((error) => log("Unable to update Discord presence", error))
				.finally(() => {
					nativeUpdateInFlight.current = false;
				});
		}
	}, [
		enabled,
		detailsTemplate,
		fileName,
		inactive,
		metadata,
		store,
		mode,
		playbackRate,
		playing,
		projectId,
		showPlaybackTimeline,
		showProjectElapsed,
		showRepositoryButton,
		showStatusBadge,
		stateTemplate,
		tracker,
	]);

	useEffect(() => {
		publish();
		const timer = window.setInterval(publish, 1000);
		return () => window.clearInterval(timer);
	}, [publish]);

	useEffect(() => {
		if (!isTauri || enabled) return;
		nativeEpoch.current++;
		lastNativePayload.current = null;
		invoke("clear_discord_activity").catch((error) =>
			log("Unable to clear Discord presence", error),
		);
	}, [enabled]);

	useEffect(
		() => () => {
			if (isTauri) void invoke("clear_discord_activity");
		},
		[],
	);

	return null;
}
