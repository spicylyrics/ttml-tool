/*
 * Copyright 2023-2025 Steve Xiao (stevexmh@qq.com) and contributors.
 *
 * 本源代码文件是属于 AMLL TTML Tool 项目的一部分。
 * This source code file is a part of AMLL TTML Tool project.
 * 本项目的源代码的使用受到 GNU GENERAL PUBLIC LICENSE version 3 许可证的约束，具体可以参阅以下链接。
 * Use of this source code is governed by the GNU GPLv3 license that can be found through the following link.
 *
 * https://github.com/spicylyrics/ttml-tool/blob/main/LICENSE
 */

/**
 * @fileoverview
 * 用于将内部歌词数组对象导出成 TTML 格式的模块
 * 但是可能会有信息会丢失
 */

import type { LyricLine, LyricWord, TTMLLyric } from "../../../types/ttml.ts";
import {
	type LyricTextNormalizationOptions,
	normalizeLyricText,
} from "../../../utils/apostrophe-normalization.ts";
import { log } from "../../../utils/logging.ts";
import { msToTimestamp } from "../../../utils/timestamp.ts";

export function shouldExportAsLineSynced(line: LyricLine): boolean {
	if (!line.isLineSynced) return false;

	return line.words.filter((word) => word.word.trim().length > 0).length <= 1;
}

export function collectFollowingBackgroundLines(
	lines: LyricLine[],
	mainLineIndex: number,
	allowConsecutive: boolean,
): LyricLine[] {
	const backgroundLines: LyricLine[] = [];
	const collectOnlyOne = !allowConsecutive;
	for (let index = mainLineIndex + 1; index < lines.length; index++) {
		const line = lines[index];
		if (!line.isBG) break;
		backgroundLines.push(line);
		if (collectOnlyOne) break;
	}
	return backgroundLines;
}

export function hasExportableLineContent(line: LyricLine): boolean {
	return (
		line.words.some(
			(word) => word.word.trim().length > 0 || word.romanWord.trim().length > 0,
		) ||
		line.translatedLyric.trim().length > 0 ||
		line.romanLyric.trim().length > 0
	);
}

export interface TTMLExportOptions {
	allowConsecutiveBackgroundLines?: boolean;
}

export default function exportTTMLText(
	ttmlLyric: TTMLLyric,
	normalization?: LyricTextNormalizationOptions,
	options: TTMLExportOptions = {},
): string {
	if (normalization) ttmlLyric = normalizeLyricText(ttmlLyric, normalization);
	const params: LyricLine[][] = [];
	const lyric = ttmlLyric.lyricLines;
	const translationLanguage = ttmlLyric.translationLanguage || "en";

	const exportableLines = lyric.filter(hasExportableLineContent);
	if (exportableLines.length > 0) params.push(exportableLines);

	const doc = new Document();

	function createWordElement(word: LyricWord): Element {
		const span = doc.createElement("span");
		span.setAttribute("begin", msToTimestamp(word.startTime));
		span.setAttribute("end", msToTimestamp(word.endTime));
		span.appendChild(doc.createTextNode(word.word));
		return span;
	}

	function findFirstTextNode(node: Node): Text | null {
		if (node.nodeType === Node.TEXT_NODE) return node as Text;
		for (const child of Array.from(node.childNodes)) {
			const found = findFirstTextNode(child);
			if (found) return found;
		}
		return null;
	}

	function findLastTextNode(node: Node): Text | null {
		if (node.nodeType === Node.TEXT_NODE) return node as Text;
		const children = Array.from(node.childNodes);
		for (let i = children.length - 1; i >= 0; i--) {
			const found = findLastTextNode(children[i]);
			if (found) return found;
		}
		return null;
	}

	function addWrapperToElement(el: Element, prefix: string, suffix: string) {
		if (!prefix && !suffix) return;
		const first = findFirstTextNode(el);
		const last = findLastTextNode(el);
		if (!first) return;
		if (first === last) {
			first.nodeValue = `${prefix}${first.nodeValue ?? ""}${suffix}`;
			return;
		}
		if (prefix) {
			first.nodeValue = `${prefix}${first.nodeValue ?? ""}`;
		}
		if (last && suffix) {
			last.nodeValue = `${last.nodeValue ?? ""}${suffix}`;
		}
	}

	function createRomanizationSpan(word: LyricWord): Element {
		const span = doc.createElement("span");
		span.setAttribute("begin", msToTimestamp(word.startTime));
		span.setAttribute("end", msToTimestamp(word.endTime));
		// A trailing space is a word gap; it goes between spans, not inside one.
		span.appendChild(doc.createTextNode(word.romanWord.trimEnd()));
		return span;
	}

	const ttRoot = doc.createElement("tt");

	ttRoot.setAttribute("xmlns", "http://www.w3.org/ns/ttml");
	ttRoot.setAttribute("xmlns:ttm", "http://www.w3.org/ns/ttml#metadata");
	ttRoot.setAttribute("xmlns:tts", "http://www.w3.org/ns/ttml#styling");
	ttRoot.setAttribute("xmlns:amll", "http://www.example.com/ns/amll");
	ttRoot.setAttribute(
		"xmlns:itunes",
		"http://music.apple.com/lyric-ttml-internal",
	);

	// Determine itunes:timing mode for Spicylyrics compatibility
	// Word = at least one line has 2+ non-blank words (dynamic/per-word timing)
	// Line = has lyric lines but every line has 0 or 1 non-blank word
	// None = no timed words at all
	const nonBlankWordCountsPerLine = lyric.map(
		(l) => l.words.filter((w) => w.word.trim().length > 0).length,
	);
	const totalNonBlankWords = nonBlankWordCountsPerLine.reduce(
		(sum, v) => sum + v,
		0,
	);
	const hasAnyTiming = lyric.some((l) =>
		l.words.some((w) => w.word.trim().length > 0 && w.endTime > w.startTime),
	);
	let timingMode: "Word" | "Line" | "None";
	if (totalNonBlankWords === 0 || !hasAnyTiming) timingMode = "None";
	else if (nonBlankWordCountsPerLine.some((c) => c > 1)) timingMode = "Word";
	else timingMode = "Line";
	ttRoot.setAttribute("itunes:timing", timingMode);

	doc.appendChild(ttRoot);

	const head = doc.createElement("head");

	ttRoot.appendChild(head);

	const body = doc.createElement("body");
	const hasOtherPerson = !!lyric.find((v) => v.isDuet);

	const metadataEl = doc.createElement("metadata");
	const mainPersonAgent = doc.createElement("ttm:agent");
	mainPersonAgent.setAttribute("type", "person");
	mainPersonAgent.setAttribute("xml:id", "v1");

	metadataEl.appendChild(mainPersonAgent);

	if (hasOtherPerson) {
		const otherPersonAgent = doc.createElement("ttm:agent");
		otherPersonAgent.setAttribute("type", "person");
		otherPersonAgent.setAttribute("xml:id", "v2");

		metadataEl.appendChild(otherPersonAgent);
	}

	// Extract songwriter metadata to emit in iTunes format (Spicylyrics compatibility)
	const songwriterMeta = ttmlLyric.metadata.find(
		(m) => m.key === "songwriter" && m.value.some((v) => v.trim().length > 0),
	);

	if (songwriterMeta) {
		const iTunesMetadata = doc.createElement("iTunesMetadata");
		iTunesMetadata.setAttribute(
			"xmlns",
			"http://music.apple.com/lyric-ttml-internal",
		);
		const songwritersEl = doc.createElement("songwriters");
		for (const name of songwriterMeta.value) {
			const trimmed = name.trim();
			if (!trimmed) continue;
			const swEl = doc.createElement("songwriter");
			swEl.appendChild(doc.createTextNode(trimmed));
			songwritersEl.appendChild(swEl);
		}
		if (songwritersEl.childNodes.length > 0) {
			iTunesMetadata.appendChild(songwritersEl);
			metadataEl.appendChild(iTunesMetadata);
		}
	}

	// Append remaining metadata entries (skip songwriter since it's in iTunes format)
	for (const metadata of ttmlLyric.metadata) {
		if (metadata.key === "songwriter") continue;
		if (metadata.key === "amll:marks") continue; // We'll handle this separately
		for (const value of metadata.value) {
			const metaEl = doc.createElement("amll:meta");
			metaEl.setAttribute("key", metadata.key);
			metaEl.setAttribute("value", value);
			metadataEl.appendChild(metaEl);
		}
	}

	if (ttmlLyric.marks && ttmlLyric.marks.length > 0) {
		for (const mark of ttmlLyric.marks) {
			const metaEl = doc.createElement("amll:meta");
			metaEl.setAttribute("key", "amll:marks");
			metaEl.setAttribute("value", JSON.stringify(mark));
			metadataEl.appendChild(metaEl);
		}
	}

	if (ttmlLyric.sections && ttmlLyric.sections.length > 0) {
		const metaEl = doc.createElement("amll:meta");
		metaEl.setAttribute("key", "amll:sections");
		metaEl.setAttribute(
			"value",
			JSON.stringify({ version: 1, sections: ttmlLyric.sections }),
		);
		metadataEl.appendChild(metaEl);
	}

	head.appendChild(metadataEl);

	let i = 0;

	const romanizationMap = new Map<
		string,
		{ main: LyricWord[]; backgrounds: LyricWord[][] }
	>();

	const guessDuration = lyric[lyric.length - 1]?.endTime ?? 0;
	body.setAttribute("dur", msToTimestamp(guessDuration));
	for (const param of params) {
		const paramDiv = doc.createElement("div");
		const beginTime = param[0]?.startTime ?? 0;
		const endTime = param[param.length - 1]?.endTime ?? 0;

		paramDiv.setAttribute("begin", msToTimestamp(beginTime));
		paramDiv.setAttribute("end", msToTimestamp(endTime));

		for (let lineIndex = 0; lineIndex < param.length; lineIndex++) {
			const line = param[lineIndex];
			const exportAsStandaloneBackground =
				(options.allowConsecutiveBackgroundLines ?? false) && line.isBG;
			const lineP = doc.createElement("p");
			const beginTime = line.startTime ?? 0;
			const endTime = line.endTime;

			lineP.setAttribute("begin", msToTimestamp(beginTime));
			lineP.setAttribute("end", msToTimestamp(endTime));

			lineP.setAttribute("ttm:agent", line.isDuet ? "v2" : "v1");

			const itunesKey = `L${++i}`;
			lineP.setAttribute("itunes:key", itunesKey);
			if (line.sectionId) {
				lineP.setAttribute("amll:section", line.sectionId);
			}

			const mainWords = exportAsStandaloneBackground ? [] : line.words;
			const backgroundWordGroups: LyricWord[][] = [];

			if (exportAsStandaloneBackground) {
				// The line is emitted below as x-bg inside an otherwise empty p.
			} else if (shouldExportAsLineSynced(line)) {
				lineP.appendChild(
					doc.createTextNode(line.words.map((word) => word.word).join("")),
				);
			} else {
				for (const word of line.words) {
					if (word.word.trim().length === 0) {
						lineP.appendChild(doc.createTextNode(word.word));
					} else {
						const span = createWordElement(word);
						lineP.appendChild(span);
					}
				}
				lineP.setAttribute("begin", msToTimestamp(line.startTime));
				lineP.setAttribute("end", msToTimestamp(line.endTime));
			}

			const followingBackgroundLines = collectFollowingBackgroundLines(
				param,
				lineIndex,
				options.allowConsecutiveBackgroundLines ?? false,
			);
			const backgroundLines = exportAsStandaloneBackground
				? [line, ...followingBackgroundLines]
				: followingBackgroundLines;
			lineIndex += followingBackgroundLines.length;
			if (exportAsStandaloneBackground) {
				lineP.setAttribute(
					"end",
					msToTimestamp(
						backgroundLines[backgroundLines.length - 1]?.endTime ??
							line.endTime,
					),
				);
			}
			for (const bgLine of backgroundLines) {
				backgroundWordGroups.push(bgLine.words);

				const bgLineSpan = doc.createElement("span");
				bgLineSpan.setAttribute("ttm:role", "x-bg");

				if (shouldExportAsLineSynced(bgLine)) {
					bgLineSpan.appendChild(
						doc.createTextNode(
							`(${bgLine.words.map((word) => word.word).join("")})`,
						),
					);
				} else {
					let beginTime = Number.POSITIVE_INFINITY;
					let endTime = 0;

					const firstWordIndex = bgLine.words.findIndex(
						(w) => w.word.trim().length > 0,
					);
					const lastWordIndex = bgLine.words
						.map((w) => w.word.trim().length > 0)
						.lastIndexOf(true);

					for (
						let wordIndex = 0;
						wordIndex < bgLine.words.length;
						wordIndex++
					) {
						const word = bgLine.words[wordIndex];
						if (word.word.trim().length === 0) {
							bgLineSpan.appendChild(doc.createTextNode(word.word));
						} else {
							const span = createWordElement(word);

							const prefix = wordIndex === firstWordIndex ? "(" : "";
							const suffix = wordIndex === lastWordIndex ? ")" : "";
							addWrapperToElement(span, prefix, suffix);

							bgLineSpan.appendChild(span);
							beginTime = Math.min(beginTime, word.startTime);
							endTime = Math.max(endTime, word.endTime);
						}
					}
					bgLineSpan.setAttribute("begin", msToTimestamp(beginTime));
					bgLineSpan.setAttribute("end", msToTimestamp(endTime));
				}

				if (bgLine.translatedLyric) {
					const span = doc.createElement("span");
					span.setAttribute("ttm:role", "x-translation");
					span.setAttribute("xml:lang", translationLanguage);
					span.appendChild(doc.createTextNode(bgLine.translatedLyric));
					bgLineSpan.appendChild(span);
				}

				if (bgLine.romanLyric) {
					const span = doc.createElement("span");
					span.setAttribute("ttm:role", "x-roman");
					span.appendChild(doc.createTextNode(bgLine.romanLyric));
					bgLineSpan.appendChild(span);
				}

				lineP.appendChild(bgLineSpan);
			}

			if (!exportAsStandaloneBackground && line.translatedLyric) {
				const span = doc.createElement("span");
				span.setAttribute("ttm:role", "x-translation");
				span.setAttribute("xml:lang", translationLanguage);
				span.appendChild(doc.createTextNode(line.translatedLyric));
				lineP.appendChild(span);
			}

			if (!exportAsStandaloneBackground && line.romanLyric) {
				const span = doc.createElement("span");
				span.setAttribute("ttm:role", "x-roman");
				span.appendChild(doc.createTextNode(line.romanLyric));
				lineP.appendChild(span);
			}

			const hasRoman =
				mainWords.some((w) => w.romanWord && w.romanWord.trim().length > 0) ||
				backgroundWordGroups.some((words) =>
					words.some((w) => w.romanWord && w.romanWord.trim().length > 0),
				);

			if (hasRoman) {
				romanizationMap.set(itunesKey, {
					main: mainWords,
					backgrounds: backgroundWordGroups,
				});
			}

			paramDiv.appendChild(lineP);
		}

		body.appendChild(paramDiv);
	}

	if (romanizationMap.size > 0) {
		const itunesMeta = doc.createElement("iTunesMetadata");
		itunesMeta.setAttribute(
			"xmlns",
			"http://music.apple.com/lyric-ttml-internal",
		);

		const transliterations = doc.createElement("transliterations");
		const transliteration = doc.createElement("transliteration");

		for (const [key, { main, backgrounds }] of romanizationMap.entries()) {
			const textEl = doc.createElement("text");
			textEl.setAttribute("for", key);

			for (let wordIndex = 0; wordIndex < main.length; wordIndex++) {
				const word = main[wordIndex];
				if (word.romanWord && word.romanWord.trim().length > 0) {
					textEl.appendChild(createRomanizationSpan(word));
					// Lines without spaces (Japanese) only get romanized word gaps
					// from the syllable; a spaced line writes its own below.
					const next = main[wordIndex + 1];
					if (/\s$/.test(word.romanWord) && next?.word.trim()) {
						textEl.appendChild(doc.createTextNode(" "));
					}
				} else if (word.word.trim().length === 0 && textEl.hasChildNodes()) {
					textEl.appendChild(doc.createTextNode(word.word));
				}
			}

			for (const bg of backgrounds) {
				const hasBgRoman = bg.some(
					(w) => w.romanWord && w.romanWord.trim().length > 0,
				);
				if (!hasBgRoman) continue;
				const bgSpan = doc.createElement("span");
				bgSpan.setAttribute("ttm:role", "x-bg");

				const romanBgWords = bg.filter(
					(w) => w.romanWord && w.romanWord.trim().length > 0,
				);

				for (let wordIndex = 0; wordIndex < romanBgWords.length; wordIndex++) {
					const word = romanBgWords[wordIndex];
					const span = createRomanizationSpan(word);

					if (wordIndex === 0 && span.firstChild) {
						span.firstChild.nodeValue = `(${span.firstChild.nodeValue}`;
					}
					if (wordIndex === romanBgWords.length - 1 && span.firstChild) {
						span.firstChild.nodeValue = `${span.firstChild.nodeValue})`;
					}

					bgSpan.appendChild(span);

					const originalIndex = bg.indexOf(word);
					if (originalIndex > -1 && originalIndex < bg.length - 1) {
						const nextWord = bg[originalIndex + 1];
						if (nextWord && nextWord.word.trim().length === 0) {
							bgSpan.appendChild(doc.createTextNode(nextWord.word));
						}
					}
				}
				textEl.appendChild(bgSpan);
			}

			transliteration.appendChild(textEl);
		}

		transliterations.appendChild(transliteration);
		itunesMeta.appendChild(transliterations);

		metadataEl.appendChild(itunesMeta);
	}

	ttRoot.appendChild(body);
	log("ttml document built", ttRoot);

	return removeEmptyDefaultNamespaces(
		new XMLSerializer().serializeToString(doc),
	);
}

/**
 * The document is built with createElement, so every element has no namespace.
 * WebKit (the macOS and Linux apps, Safari) serializes that faithfully as
 * `xmlns=""` on each element; Chromium leaves it out. Spicy Lyrics' parser
 * then reads `<songwriter xmlns="">Name</songwriter>` as an object and shows
 * "[object Object]" for the credits. Dropping the attribute gives every engine
 * Chromium's output. Only tags are touched: text can't start a tag because the
 * serializer escapes `<`, and attribute values can't hold the literal because
 * it escapes `"`.
 */
export function removeEmptyDefaultNamespaces(xml: string): string {
	return xml.replace(/<[^>]*>/g, (tag) => tag.replace(/ xmlns=""/g, ""));
}
