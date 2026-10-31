import { distributeTime as distributeUnitTimes } from "$/modules/lyric-editor/utils/distribute-time";
/**
 * @description 分词引擎
 */

import { type LyricLine, type LyricWord, newLyricWord } from "$/types/ttml";
import { CharType, type SegmentationConfig } from "../types";
import {
	escapeRegExp,
	getCharType,
	getMergeDirection,
	MergeDirection,
	PUNCT_AMBIGUOUS_QUOTES,
} from "./charUtils";
import { applyLearnedRule } from "./learned-rules";
import {
	getHyphenationLanguage,
	getSyllabificationEngine,
	splitJapaneseText,
} from "./syllabification-engines";

export interface SegmentationContext {
	/**
	 * true 表示当前处于引号内部（下一个引号是闭引号）
	 */
	isQuoteOpen: boolean;
}

/**
 * @description 判断两个相邻字符是否应该合并
 */
function isMergeablePair(
	prev: CharType,
	curr: CharType,
	splitCJK: boolean,
): boolean {
	if (prev !== curr) {
		return false;
	}

	switch (prev) {
		case CharType.Latin:
		case CharType.Numeric:
		case CharType.Whitespace:
			return true;
		case CharType.Cjk:
			return !splitCJK;
		default:
			return false;
	}
}

/**
 * @description 自动将一个字符串拆分为 token
 */
function autoTokenize(text: string, config: SegmentationConfig): string[] {
	if (!text) {
		return [];
	}
	if (config.engine === "none") return [text];
	if (config.engine === "japanese") return splitJapaneseText(text);
	const tokens: string[] = [];
	let currentToken = "";
	let lastCharType: CharType | null = null;

	const pushCurrentToken = () => {
		if (!currentToken) return;

		if (
			lastCharType === CharType.Latin &&
			config.splitEnglish &&
			currentToken.length > 1
		) {
			const syllables =
				getHyphenationLanguage(config.engine) && config.hyphenator
					? config.hyphenator(currentToken).split("\u00AD")
					: getSyllabificationEngine(config.engine).split(currentToken);
			tokens.push(...syllables);
		} else {
			tokens.push(currentToken);
		}
		currentToken = "";
	};

	const graphemes = Array.from(text);

	for (const grapheme of graphemes) {
		const firstChar = grapheme.length > 0 ? Array.from(grapheme)[0] : " ";
		const currentCharType = getCharType(firstChar);

		if (lastCharType !== null) {
			let shouldBreak = false;

			if (currentCharType === CharType.Cjk && config.splitCJK) {
				shouldBreak = true;
			} else if (lastCharType === CharType.Cjk && config.splitCJK) {
				shouldBreak = true;
			} else if (currentCharType === CharType.Other) {
				shouldBreak = true;
			} else if (lastCharType === CharType.Other) {
				shouldBreak = true;
			}

			if (
				!shouldBreak &&
				!isMergeablePair(lastCharType, currentCharType, config.splitCJK)
			) {
				shouldBreak = true;
			}

			if (shouldBreak && currentToken) {
				pushCurrentToken();
			}
		}

		currentToken += grapheme;
		lastCharType = currentCharType;
	}

	pushCurrentToken();

	return tokens;
}

function calculateWeight(token: string, config: SegmentationConfig): number {
	if (!token) {
		return 0;
	}
	const firstChar = token.length > 0 ? Array.from(token)[0] : " ";
	const charType = getCharType(firstChar);

	switch (charType) {
		case CharType.Latin:
		case CharType.Numeric:
		case CharType.Cjk:
			return token.length;
		case CharType.Other:
			return config.punctuationWeight;
		case CharType.Whitespace:
			return 0.0;
		default:
			return 0.0;
	}
}

function calculateLearnedWeight(
	token: string,
	config: SegmentationConfig,
): number {
	return Array.from(token).reduce((weight, char) => {
		switch (getCharType(char)) {
			case CharType.Latin:
			case CharType.Numeric:
			case CharType.Cjk:
				return weight + 1;
			case CharType.Other:
				return weight + config.punctuationWeight;
			default:
				return weight;
		}
	}, 0);
}

/**
 * @description 后处理
 *
 * 处理标点粘连，过滤空字符，计算总权重
 * @returns 处理完的 Token 列表、对应的权重列表、总权重
 */
function postProcess(
	tokens: string[],
	config: SegmentationConfig,
	context?: SegmentationContext,
): { finalTokens: string[]; finalWeights: number[] } {
	const processedTokens: string[] = [];
	const tokenWeights: number[] = [];

	/**
	 * @description 用于存储等待向右合并的标点。例如 `(`
	 */
	let pendingPrefix = "";
	let pendingPrefixWeight = 0;

	for (const token of tokens) {
		const tokenWeight = calculateWeight(token, config);
		const firstChar = token.length > 0 ? Array.from(token)[0] : " ";
		// A token of only apostrophes is a quote mark, not a syllable: `Run!'`.
		const charType = /^['’]+$/.test(token)
			? CharType.Other
			: getCharType(firstChar);

		if (config.punctuationMode === "merge" && charType === CharType.Other) {
			let direction = getMergeDirection(token);

			if (context && PUNCT_AMBIGUOUS_QUOTES.has(token)) {
				if (context.isQuoteOpen) {
					direction = MergeDirection.Left;
					context.isQuoteOpen = false;
				} else {
					direction = MergeDirection.Right;
					context.isQuoteOpen = true;
				}
			}

			if (direction === MergeDirection.Right) {
				// 向右合并
				pendingPrefix += token;
				pendingPrefixWeight += tokenWeight;
			} else {
				// 向左合并
				if (processedTokens.length > 0) {
					processedTokens[processedTokens.length - 1] += token;
					tokenWeights[tokenWeights.length - 1] += tokenWeight;
				} else {
					// 行首就是应该向左合并的标点符号，存起来然后合并到第一个音节中
					pendingPrefix += token;
					pendingPrefixWeight += tokenWeight;
				}
			}
		} else {
			// 实词，将缓冲区的标点拼接在词前
			const combinedToken = pendingPrefix + token;
			const combinedWeight = pendingPrefixWeight + tokenWeight;

			processedTokens.push(combinedToken);
			tokenWeights.push(combinedWeight);

			pendingPrefix = "";
			pendingPrefixWeight = 0;
		}
	}

	// 行尾缓冲区里还有应该向右合并的标点，拼接到上一个词中
	if (pendingPrefix) {
		if (processedTokens.length > 0) {
			processedTokens[processedTokens.length - 1] += pendingPrefix;
			tokenWeights[tokenWeights.length - 1] += pendingPrefixWeight;
		} else {
			// 整行都只有标点了
			processedTokens.push(pendingPrefix);
			tokenWeights.push(pendingPrefixWeight);
		}
	}

	// 权重计算
	const finalTokens: string[] = [];
	const finalWeights: number[] = [];

	for (let i = 0; i < processedTokens.length; i++) {
		const token = processedTokens[i];
		const weight = tokenWeights[i];

		if (token === "" && config.removeEmptySegments) {
			continue;
		}

		finalTokens.push(token);
		finalWeights.push(weight);
	}

	return { finalTokens, finalWeights };
}

/**
 * @description 把原 `LyricWord` 的总时长按权重分给切分后的 `tokens`
 * @param originalWord 原始的大词对象
 * @param tokens 切分后的文本数组
 * @param weights 对应的权重数组
 */
function distributeTime(
	originalWord: LyricWord,
	tokens: string[],
	weights: number[],
): LyricWord[] {
	if (tokens.length === 0) {
		return [];
	}
	if (tokens.length === 1) {
		return distributeUnitTimes(
			[{ ...originalWord, word: tokens[0] }],
			originalWord.startTime,
			originalWord.endTime,
			{ empty: "include" },
		);
	}

	return distributeUnitTimes(
		tokens.map((token) => ({ ...newLyricWord(), word: token })),
		originalWord.startTime,
		originalWord.endTime,
		{ weight: weights },
	);
}

/**
 * @description 将单个 LyricWord 拆分为多个
 */
function prepareProtectedPattern(config: SegmentationConfig): RegExp | null {
	const protectedWords = new Set([
		...config.ignoreList,
		...config.customRules.keys(),
	]);
	const patterns = [...protectedWords]
		.filter((word) => word.trim() !== "")
		.sort((a, b) => b.length - a.length)
		.map(escapeRegExp);
	return patterns.length > 0
		? new RegExp(`(${patterns.join("|")})`, "g")
		: null;
}

export function segmentWord(
	word: LyricWord,
	config: SegmentationConfig,
	context?: SegmentationContext,
	pattern = prepareProtectedPattern(config),
): LyricWord[] {
	const learnedSegments = applyLearnedRule(word.word, config.learnedRules);
	if (learnedSegments) {
		const weights = learnedSegments.map((token) =>
			calculateLearnedWeight(token, config),
		);
		return distributeTime(word, learnedSegments, weights);
	}

	const ctx = context || { isQuoteOpen: false };

	if (!pattern) {
		const tokens = autoTokenize(word.word, config);
		if (tokens.length === 0) return [];
		const { finalTokens, finalWeights } = postProcess(tokens, config, ctx);
		return distributeTime(word, finalTokens, finalWeights);
	}

	const parts = word.word.split(pattern);

	const allTokens: string[] = [];
	const allWeights: number[] = [];

	for (const part of parts) {
		if (!part) continue;

		if (config.customRules.has(part)) {
			const ruleParts = config.customRules.get(part);
			if (!ruleParts) continue;
			for (const token of ruleParts) {
				const weight = calculateWeight(token, config);
				allTokens.push(token);
				allWeights.push(weight);
			}
		} else if (config.ignoreList.has(part)) {
			const weight = calculateWeight(part, config);
			allTokens.push(part);
			allWeights.push(weight);
		} else {
			const tokens = autoTokenize(part, config);
			const { finalTokens, finalWeights } = postProcess(tokens, config, ctx);
			allTokens.push(...finalTokens);
			allWeights.push(...finalWeights);
		}
	}

	return distributeTime(word, allTokens, allWeights);
}

/**
 * 批量处理歌词行，支持跨词的上下文状态（如引号合并方向）
 *
 * 一般推荐优先使用这个函数而不是 segmentWord，因为这个函数可以处理英文双引号的方向
 * @param lines 歌词行数组
 * @param config 分词配置
 * @param resetStatePerLine 是否每行重置上下文状态。默认 false 以支持跨行引号，设为 true 可以防止上一行未闭合的引号影响下一行
 */
export function segmentLyricLines(
	lines: LyricLine[],
	config: SegmentationConfig,
	resetStatePerLine = true,
): LyricLine[] {
	const context: SegmentationContext = { isQuoteOpen: false };
	const pattern = prepareProtectedPattern(config);

	return lines.map((line) => {
		if (resetStatePerLine) {
			context.isQuoteOpen = false;
		}

		const newWords: LyricWord[] = [];
		for (const word of line.words) {
			const segments = segmentWord(word, config, context, pattern);
			newWords.push(...segments);
		}

		return {
			...line,
			words: newWords,
		};
	});
}

/**
 * Segments only the selected words, in place. Each word's time is spread over
 * its segments the same way {@link segmentLyricLines} does it. Mutates `lines`
 * (an Immer draft is fine) and returns how many words were split.
 */
export function segmentSelectedWords(
	lines: LyricLine[],
	selectedWordIds: ReadonlySet<string>,
	config: SegmentationConfig,
): number {
	let splitCount = 0;
	const pattern = prepareProtectedPattern(config);
	for (const line of lines) {
		if (!line.words.some((w) => selectedWordIds.has(w.id))) continue;
		const context: SegmentationContext = { isQuoteOpen: false };
		const newWords: LyricWord[] = [];
		for (const word of line.words) {
			if (!selectedWordIds.has(word.id)) {
				newWords.push(word);
				continue;
			}
			const segments = segmentWord(word, config, context, pattern);
			if (segments.length > 1) splitCount++;
			newWords.push(...segments);
		}
		line.words = newWords;
	}
	return splitCount;
}

/**
 * 手动分词的时间重计算
 *
 * 用于当已经有了手动指定的分词结果，需要重新计算时间戳时
 *
 * 一个典型应用是拆分单词对话框里的手动分词
 */
export function recalculateWordTime(
	originalWord: LyricWord,
	segments: string[],
	config: SegmentationConfig,
): LyricWord[] {
	const weights = segments.map((token) => calculateWeight(token, config));

	return distributeTime(originalWord, segments, weights);
}
