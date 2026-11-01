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
 * 解析 TTML 歌词文档到歌词数组的解析器
 * 用于解析从 Apple Music 来的歌词文件，且扩展并支持翻译和音译文本。
 * @see https://www.w3.org/TR/2018/REC-ttml1-20181108/
 */

import { uid } from "uid";
import type {
	LyricLine,
	LyricWord,
	Mark,
	TTMLLyric,
	TTMLMetadata,
} from "../../../types/ttml.ts";
import { log } from "../../../utils/logging.ts";
import { parseTimespan } from "../../../utils/timestamp.ts";

interface RomanWord {
	startTime: number;
	endTime: number;
	text: string;
}

interface LineMetadata {
	main: string;
	bg: string;
}

interface WordRomanMetadata {
	main: RomanWord[];
	bg: RomanWord[];
}

interface SpanNode {
	text: string;
	begin: string | null;
	end: string | null;
	role: string | null;
	lang: string | null;
	ruby: string | null;
	children: SpanNode[];
	tail: string;
}

/** Adapted from apoint123's upstream AMLL TTML Tool fix (04dbee4b). */
export function separateTrailingWhitespace(words: LyricWord[]): LyricWord[] {
	return words.flatMap((word) => {
		// trimEnd strips the same characters as \s, in linear time. The /\s+$/
		// regex backtracks quadratically on long whitespace runs.
		const trimmedLength = word.word.trimEnd().length;
		const spaces = word.word.slice(trimmedLength);
		if (!spaces || trimmedLength === 0) return [word];
		return [
			{ ...word, word: word.word.slice(0, -spaces.length) },
			{
				id: uid(),
				word: spaces,
				startTime: 0,
				endTime: 0,
				obscene: false,
				romanWord: "",
			},
		];
	});
}

export function appendParentBeforeNestedLines(
	lines: LyricLine[],
	nestedStartIndex: number,
	parent: LyricLine,
) {
	const nestedLines = lines.splice(nestedStartIndex);
	const hasParentContent =
		parent.words.some((word) => word.word.trim().length > 0) ||
		parent.translatedLyric.trim().length > 0 ||
		parent.romanLyric.trim().length > 0;
	if (nestedLines.length > 0 && !hasParentContent) {
		lines.push(...nestedLines);
		return;
	}
	lines.push(parent, ...nestedLines);
}

function localName(el: Element): string {
	return el.localName || el.tagName.split(":").pop() || el.tagName;
}

function getAttr(el: Element, target: string): string | null {
	const direct = el.getAttribute(target);
	if (direct !== null) {
		return direct;
	}
	for (const attr of Array.from(el.attributes)) {
		if (
			attr.localName === target ||
			attr.name === target ||
			attr.name.endsWith(`:${target}`)
		) {
			return attr.value;
		}
	}
	return null;
}

function parseSpan(spanEl: Element): SpanNode {
	const span: SpanNode = {
		text: "",
		begin: getAttr(spanEl, "begin"),
		end: getAttr(spanEl, "end"),
		role: getAttr(spanEl, "role"),
		lang: getAttr(spanEl, "lang"),
		ruby: getAttr(spanEl, "ruby"),
		children: [],
		tail: "",
	};
	let lastChild: SpanNode | null = null;
	for (const node of Array.from(spanEl.childNodes)) {
		if (node.nodeType === Node.TEXT_NODE) {
			const text = node.textContent ?? "";
			if (lastChild) {
				lastChild.tail += text;
			} else {
				span.text += text;
			}
		} else if (node.nodeType === Node.ELEMENT_NODE) {
			const childEl = node as Element;
			if (localName(childEl) === "span") {
				const child = parseSpan(childEl);
				span.children.push(child);
				lastChild = child;
			}
		}
	}
	return span;
}

function flattenSpanText(span: SpanNode, skipRoles?: Set<string>): string {
	const skipCurrent =
		(span.role ? skipRoles?.has(span.role) : false) ||
		["text", "textContainer", "delimiter"].includes(span.ruby ?? "");
	let text = "";
	if (!skipCurrent) {
		text += span.text || "";
		for (const child of span.children) {
			text += flattenSpanText(child, skipRoles);
		}
	}
	text += span.tail || "";
	return text;
}

function flattenSpanInnerText(span: SpanNode, skipRoles?: Set<string>): string {
	const skipCurrent =
		(span.role ? skipRoles?.has(span.role) : false) ||
		["text", "textContainer", "delimiter"].includes(span.ruby ?? "");
	let text = "";
	if (!skipCurrent) {
		text += span.text || "";
		for (const child of span.children) {
			text += flattenSpanText(child, skipRoles);
		}
	}
	return text;
}

function createWordFromSpanElement(
	wordEl: Element,
	lineStart: number,
	lineEnd: number,
): LyricWord | null {
	const baseEl = Array.from(wordEl.children).find(
		(child) => getAttr(child, "ruby") === "base",
	);
	const begin =
		getAttr(wordEl, "begin") ?? (baseEl ? getAttr(baseEl, "begin") : null);
	const end =
		getAttr(wordEl, "end") ?? (baseEl ? getAttr(baseEl, "end") : null);
	const spanNode = parseSpan(wordEl);
	const skipRoles = new Set(["x-translation", "x-roman"]);
	// Older exports timed only the readings. Keep their base text using the
	// enclosing line's timing, without borrowing discarded annotation times.
	if ((!begin || !end) && spanNode.ruby !== "container") {
		return null;
	}
	const wordText = flattenSpanInnerText(spanNode, skipRoles);
	const word: LyricWord = {
		id: uid(),
		word: wordText,
		startTime: begin ? parseTimespan(begin) : lineStart,
		endTime: end ? parseTimespan(end) : lineEnd,
		obscene: false,
		romanWord: "",
	};
	return word;
}

export function parseLyric(ttmlText: string): TTMLLyric {
	const domParser = new DOMParser();
	const ttmlDoc: XMLDocument = domParser.parseFromString(
		ttmlText,
		"application/xml",
	);

	log("ttml document parsed", ttmlDoc);

	const itunesTranslations = new Map<string, LineMetadata>();
	const translationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > translations > translation > text[for]",
	);

	translationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;

		let main = "";
		let bg = "";

		for (const node of Array.from(textEl.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				main += node.textContent ?? "";
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if ((node as Element).getAttribute("ttm:role") === "x-bg") {
					bg += node.textContent ?? "";
				}
			}
		}

		main = main.trim();
		bg = bg
			.trim()
			.replace(/^[（(]/, "")
			.replace(/[)）]$/, "")
			.trim();

		if (main.length > 0 || bg.length > 0) {
			itunesTranslations.set(key, { main, bg });
		}
	});

	const itunesLineRomanizations = new Map<string, LineMetadata>();
	const itunesWordRomanizations = new Map<string, WordRomanMetadata>();

	const romanizationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > transliterations > transliteration > text[for]",
	);

	romanizationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;

		const mainWords: RomanWord[] = [];
		const bgWords: RomanWord[] = [];
		let lineRomanMain = "";
		let lineRomanBg = "";
		let isWordByWord = false;

		for (const node of Array.from(textEl.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				const text = node.textContent ?? "";
				const previous = mainWords[mainWords.length - 1];
				// Apple stores romanized word gaps as spaces between the syllable
				// spans. Keep them on the syllable before; newlines are just indent.
				if (previous && /^[^\S\r\n]+$/.test(text)) previous.text += " ";
				else lineRomanMain += text;
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				const el = node as Element;
				if (el.getAttribute("ttm:role") === "x-bg") {
					const nestedSpans = el.querySelectorAll("span[begin][end]");
					if (nestedSpans.length > 0) {
						isWordByWord = true;
						nestedSpans.forEach((span) => {
							let bgWordText = span.textContent ?? "";
							bgWordText = bgWordText
								.trim()
								.replace(/^[（(]/, "")
								.replace(/[)）]$/, "")
								.trim();

							bgWords.push({
								startTime: parseTimespan(span.getAttribute("begin") ?? ""),
								endTime: parseTimespan(span.getAttribute("end") ?? ""),
								text: bgWordText,
							});
						});
					} else {
						lineRomanBg += el.textContent ?? "";
					}
				} else if (el.hasAttribute("begin") && el.hasAttribute("end")) {
					isWordByWord = true;
					mainWords.push({
						startTime: parseTimespan(el.getAttribute("begin") ?? ""),
						endTime: parseTimespan(el.getAttribute("end") ?? ""),
						text: el.textContent ?? "",
					});
				}
			}
		}

		if (isWordByWord) {
			itunesWordRomanizations.set(key, { main: mainWords, bg: bgWords });
		}

		lineRomanMain = lineRomanMain.trim();
		lineRomanBg = lineRomanBg
			.trim()
			.replace(/^[（(]/, "")
			.replace(/[)）]$/, "")
			.trim();

		if (lineRomanMain.length > 0 || lineRomanBg.length > 0) {
			itunesLineRomanizations.set(key, {
				main: lineRomanMain,
				bg: lineRomanBg,
			});
		}
	});

	const itunesTimedTranslations = new Map<string, LineMetadata>();
	const timedTranslationTextElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > translations > translation > text[for]",
	);

	timedTranslationTextElements.forEach((textEl) => {
		const key = textEl.getAttribute("for");
		if (!key) return;

		let main = "";
		let bg = "";

		for (const node of Array.from(textEl.childNodes)) {
			if (node.nodeType === Node.TEXT_NODE) {
				main += node.textContent ?? "";
			} else if (node.nodeType === Node.ELEMENT_NODE) {
				if ((node as Element).getAttribute("ttm:role") === "x-bg") {
					bg += node.textContent ?? "";
				}
			}
		}

		main = main.trim();
		bg = bg
			.trim()
			.replace(/^[（(]/, "")
			.replace(/[)）]$/, "")
			.trim();

		if ((main.length > 0 || bg.length > 0) && textEl.querySelector("span")) {
			itunesTimedTranslations.set(key, { main, bg });
			itunesTranslations.delete(key);
		}
	});

	let mainAgentId = "v1";

	const metadata: TTMLMetadata[] = [];
	const metaTags = ttmlDoc.getElementsByTagNameNS("*", "meta");
	for (let i = 0; i < metaTags.length; i++) {
		const meta = metaTags[i];
		if (localName(meta) === "meta") {
			const key = getAttr(meta, "key");
			if (key) {
				const value = getAttr(meta, "value");
				if (value) {
					const existing = metadata.find((m) => m.key === key);
					if (existing) {
						existing.value.push(value);
					} else {
						metadata.push({
							key,
							value: [value],
						});
					}
				}
			}
		}
	}

	const songwriterElements = ttmlDoc.querySelectorAll(
		"iTunesMetadata > songwriters > songwriter",
	);
	if (songwriterElements.length > 0) {
		const songwriterValues: string[] = [];
		songwriterElements.forEach((el) => {
			const name = el.textContent?.trim();
			if (name) {
				songwriterValues.push(name);
			}
		});
		if (songwriterValues.length > 0) {
			metadata.push({
				key: "songwriter",
				value: songwriterValues,
			});
		}
	}

	// Duet singers are both "person" agents, so declaration order can't pick
	// the main one. Prefer v1 when it exists; otherwise use the first person.
	const agentIds = Array.from(ttmlDoc.getElementsByTagNameNS("*", "agent"))
		.filter((agent) => getAttr(agent, "type") === "person")
		.map((agent) => getAttr(agent, "id"))
		.filter((id): id is string => !!id);
	if (agentIds.length > 0 && !agentIds.includes("v1")) {
		mainAgentId = agentIds[0];
	}

	const lyricLines: LyricLine[] = [];

	function parseLineElement(
		lineEl: Element,
		isBG = false,
		isDuet = false,
		parentItunesKey: string | null = null,
		parentSectionId?: string,
	) {
		const nestedStartIndex = lyricLines.length;
		const startTimeAttr = lineEl.getAttribute("begin");
		const endTimeAttr = lineEl.getAttribute("end");

		let parsedStartTime = 0;
		let parsedEndTime = 0;

		if (startTimeAttr && endTimeAttr) {
			parsedStartTime = parseTimespan(startTimeAttr);
			parsedEndTime = parseTimespan(endTimeAttr);
		}

		const agentId = getAttr(lineEl, "agent") || getAttr(lineEl, "participant");

		const line: LyricLine = {
			id: uid(),
			words: [],
			translatedLyric: "",
			romanLyric: "",
			isBG,
			isDuet: isBG ? isDuet : !!agentId && agentId !== mainAgentId,
			agent: agentId || undefined,
			startTime: parsedStartTime,
			endTime: parsedEndTime,
			ignoreSync: false,
			isLineSynced: Array.from(lineEl.childNodes).some(
				(node) =>
					node.nodeType === Node.TEXT_NODE && !!node.textContent?.trim(),
			),
			sectionId: getAttr(lineEl, "section") || parentSectionId,
		};

		const itunesKey = isBG
			? parentItunesKey
			: lineEl.getAttribute("itunes:key");

		const romanWordData = itunesKey
			? itunesWordRomanizations.get(itunesKey)
			: undefined;
		const sourceRomanList = isBG ? romanWordData?.bg : romanWordData?.main;
		const availableRomanWords = sourceRomanList ? [...sourceRomanList] : [];

		if (itunesKey) {
			const timedTrans = itunesTimedTranslations.get(itunesKey);
			const lineTrans = itunesTranslations.get(itunesKey);

			if (isBG) {
				line.translatedLyric = timedTrans?.bg ?? lineTrans?.bg ?? "";
			} else {
				line.translatedLyric = timedTrans?.main ?? lineTrans?.main ?? "";
			}

			const lineRoman = itunesLineRomanizations.get(itunesKey);
			if (isBG) {
				line.romanLyric = lineRoman?.bg ?? "";
			} else {
				line.romanLyric = lineRoman?.main ?? "";
			}
		}

		const timedWordIds = new Set<string>();
		for (const wordNode of lineEl.childNodes) {
			if (wordNode.nodeType === Node.TEXT_NODE) {
				const word = wordNode.textContent ?? "";
				line.words.push({
					id: uid(),
					word: word,
					startTime: word.trim().length > 0 ? line.startTime : 0,
					endTime: word.trim().length > 0 ? line.endTime : 0,
					obscene: false,
					romanWord: "",
				});
			} else if (wordNode.nodeType === Node.ELEMENT_NODE) {
				const wordEl = wordNode as Element;
				const role = wordEl.getAttribute("ttm:role");

				if (wordEl.nodeName === "span" && role) {
					if (role === "x-bg") {
						parseLineElement(
							wordEl,
							true,
							line.isDuet,
							itunesKey,
							line.sectionId,
						);
					} else if (role === "x-translation") {
						// 没有 Apple Music 样式翻译时才使用内嵌翻译
						if (!line.translatedLyric) {
							line.translatedLyric = wordEl.textContent ?? "";
						}
					} else if (role === "x-roman") {
						if (!line.romanLyric) {
							line.romanLyric = wordEl.textContent ?? "";
						}
					}
				} else {
					const word = createWordFromSpanElement(
						wordEl,
						line.startTime,
						line.endTime,
					);
					if (!word) continue;
					if (availableRomanWords.length > 0) {
						const matchIndex = availableRomanWords.findIndex(
							(r) =>
								r.startTime === word.startTime && r.endTime === word.endTime,
						);

						if (matchIndex !== -1) {
							word.romanWord = availableRomanWords[matchIndex].text;
							availableRomanWords.splice(matchIndex, 1);
						}
					}

					timedWordIds.add(word.id);
					line.words.push(word);
				}
			}
		}

		if (!startTimeAttr || !endTimeAttr) {
			line.startTime = line.words
				.filter((w) => w.word.trim().length > 0)
				.reduce(
					(pv, cv) => Math.min(pv, cv.startTime),
					Number.POSITIVE_INFINITY,
				);
			line.endTime = line.words
				.filter((w) => w.word.trim().length > 0)
				.reduce((pv, cv) => Math.max(pv, cv.endTime), 0);
		}

		if (line.isBG) {
			const firstWordIndex = line.words.findIndex(
				(w) => w.word.trim().length > 0,
			);
			const firstWord = line.words[firstWordIndex];
			if (firstWord && /^[（(]/.test(firstWord.word)) {
				firstWord.word = firstWord.word.substring(1);
				if (firstWord.word.length === 0) {
					line.words.splice(firstWordIndex, 1);
				}
			}

			const lastWordIndex = line.words
				.map((w) => w.word.trim().length > 0)
				.lastIndexOf(true);
			const lastWord = line.words[lastWordIndex];
			if (lastWord && /[)）]$/.test(lastWord.word)) {
				lastWord.word = lastWord.word.substring(0, lastWord.word.length - 1);
				if (lastWord.word.length === 0) {
					line.words.splice(lastWordIndex, 1);
				}
			}
		}

		// Only timed spans are syllables; direct whole-line text stays intact.
		line.words = line.words.flatMap((word) =>
			timedWordIds.has(word.id) ? separateTrailingWhitespace([word]) : [word],
		);
		appendParentBeforeNestedLines(lyricLines, nestedStartIndex, line);
	}

	for (const lineEl of ttmlDoc.querySelectorAll("body p[begin][end]")) {
		parseLineElement(lineEl, false, false, null);
	}

	const marks: Mark[] = [];
	const marksMeta = metadata.find((m) => m.key === "amll:marks");
	if (marksMeta) {
		for (const v of marksMeta.value) {
			try {
				const m = JSON.parse(v);
				if (typeof m === "number") {
					marks.push({ timeMs: m });
				} else if (m && typeof m.timeMs === "number") {
					marks.push(m);
				}
			} catch {
				const t = Number.parseFloat(v);
				if (!Number.isNaN(t)) marks.push({ timeMs: t });
			}
		}
	}

	let sections: TTMLLyric["sections"];
	const sectionMeta = metadata.find((m) => m.key === "amll:sections");
	if (sectionMeta?.value[0]) {
		try {
			const parsed = JSON.parse(sectionMeta.value[0]);
			if (parsed?.version === 1 && Array.isArray(parsed.sections)) {
				sections = parsed.sections;
			}
		} catch {
			// Optional section metadata should never make an otherwise valid TTML fail.
		}
	}

	return {
		metadata: metadata.filter(
			(m) => m.key !== "amll:marks" && m.key !== "amll:sections",
		),
		lyricLines: lyricLines,
		marks: marks.length > 0 ? marks : undefined,
		sections,
		translationLanguage: translationLanguageOf(ttmlDoc, lyricLines),
	};
}

function translationLanguageOf(
	doc: Document,
	lines: LyricLine[],
): string | undefined {
	const tagged = [
		...Array.from(doc.getElementsByTagName("translation")),
		...Array.from(doc.getElementsByTagName("span")).filter(
			(span) => span.getAttribute("ttm:role") === "x-translation",
		),
	]
		.map((el) => el.getAttribute("xml:lang")?.trim())
		.find(Boolean);
	if (!tagged) return undefined;
	// Older exports tagged every translation zh-CN, whatever its language.
	const hasHan = lines.some((line) =>
		/\p{Script=Han}/u.test(line.translatedLyric),
	);
	if (/^zh\b/i.test(tagged) && !hasHan) return undefined;
	return tagged;
}
