import { useEffect, useState } from "react";
import { loadTranslationProgress } from "$/i18n/resources";
import { getTranslationProgress } from "./language";

/**
 * Completeness per interface language. Empty until every catalog has loaded
 * (the first time the language picker is shown), and stays empty if one fails.
 */
export function useTranslationProgress(): Record<string, number | null> {
	const [progress, setProgress] = useState<Record<string, number | null>>({});
	useEffect(() => {
		let active = true;
		loadTranslationProgress(getTranslationProgress).then(
			(result) => {
				if (active) setProgress(result);
			},
			(error) => console.warn("Could not load translation progress", error),
		);
		return () => {
			active = false;
		};
	}, []);
	return progress;
}
