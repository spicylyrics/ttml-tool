import { useEffect, useState } from "react";
import {
	getLoadedJapaneseTokenizer,
	loadJapaneseTokenizer,
	needsJapaneseDictionary,
} from "./engines/japanese";

/**
 * Loads the Japanese dictionary as soon as a text has kana, so actions that
 * split Japanese into words can use it. Loading stays true until it's ready;
 * if it can't load, the actions fall back to splitting by character.
 */
export function useJapaneseDictionary(text: string) {
	const needed = needsJapaneseDictionary(text);
	const [settled, setSettled] = useState(() => !!getLoadedJapaneseTokenizer());

	useEffect(() => {
		if (!needed || settled) return;
		let live = true;
		loadJapaneseTokenizer()
			.catch((error) => console.warn("Japanese dictionary didn't load", error))
			.finally(() => {
				if (live) setSettled(true);
			});
		return () => {
			live = false;
		};
	}, [needed, settled]);

	return { loading: needed && !settled };
}
