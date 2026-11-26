import { useAtom, useAtomValue } from "jotai";
import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import { type Id, toast } from "react-toastify";
import {
	audioErrorAtom,
	audioTaskStateAtom,
} from "$/modules/audio/states/index.ts";

export const useAudioFeedback = () => {
	const taskState = useAtomValue(audioTaskStateAtom);
	const [errorMsg, setErrorMsg] = useAtom(audioErrorAtom);
	const toastId = useRef<Id | null>(null);
	const { t } = useTranslation();

	useEffect(() => {
		const getMessage = (type: string) => {
			switch (type) {
				case "TRANSCODING":
					return t(
						"audio.status.transcoding",
						"Decoding failed, converting the audio…",
					);
				case "LOADING":
					return t("audio.status.loading", "Loading audio…");
				default:
					return t("audio.status.processing", "Processing…");
			}
		};

		if (taskState) {
			const { type, progress } = taskState;
			const message = getMessage(type);

			if (toastId.current === null) {
				toastId.current = toast.loading(message, {
					autoClose: false,
					closeButton: false,
					closeOnClick: false,
					draggable: false,
					progress: progress,
				});
			} else {
				toast.update(toastId.current, {
					render: message,
					progress: progress,
				});
			}
		} else {
			if (toastId.current !== null) {
				toast.dismiss(toastId.current);
				toastId.current = null;
			}
		}
	}, [taskState, t]);

	useEffect(() => {
		if (errorMsg) {
			// A missing file isn't a processing error; say what to do instead.
			if (
				errorMsg ===
				t("audio.error.noAudio", "Please load an audio file first.")
			) {
				toast.info(errorMsg, { toastId: "no-audio", autoClose: 4000 });
				setErrorMsg(null);
				return;
			}
			toast.error(
				`${t("audio.error.workerError", "处理音频时出错")}: ${errorMsg}`,
				{
					autoClose: 5000,
					closeOnClick: true,
					draggable: true,
				},
			);

			setErrorMsg(null);
		}
	}, [errorMsg, setErrorMsg, t]);
};
