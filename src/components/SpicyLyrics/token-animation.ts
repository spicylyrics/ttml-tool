/*
 * Adapted from the Spicy Lyrics renderer (AGPL-3.0-or-later).
 * Original project: https://github.com/Spikerko/Spicy-Lyrics
 */
import type { RefObject } from "react";
import {
	dotGlowSpline,
	dotOpacitySpline,
	dotScaleSpline,
	dotYSpline,
	easeSinOut,
	glowSpline,
	letterScaleSpline,
	letterYSpline,
	scaleSpline,
	simpleDotOpacitySpline,
	simpleLetterScaleSpline,
	simpleLetterYSpline,
	simpleYSpline,
	ySpline,
} from "./animation-curves";
import type { SpringSet } from "./createSpicyAnimator";
import { progressAt, Spring, stateAt } from "./math";
import type { SpicyToken } from "./model";

type TokenState = "not-sung" | "active" | "sung";

interface TokenAnimationContext {
	springs: RefObject<Map<string, SpringSet>>;
	wordNodes: RefObject<Map<string, HTMLElement>>;
	wordState: TokenState;
	simple: boolean;
	snap: boolean;
	dt: number;
	time: number;
}

/**
 * Where a word's fill edge sits, in percent. Spicy writes it every frame from
 * the word's progress, in Simple Lyrics mode as well: the dim part starts
 * further left there, and the edge reaches 70% before the word is sung.
 */
export function wordGradientAt(
	state: TokenState,
	progress: number,
	simple: boolean,
) {
	const rest = simple ? -50 : -20;
	return state === "active"
		? rest + 120 * progress
		: state === "sung"
			? 100
			: rest;
}

/** The custom property each mode's word and letter gradient reads. */
const gradientProperty = (simple: boolean) =>
	simple ? "--spicy-slm-gradient-position" : "--gradient-position";

export function createTokenAnimator({
	springs,
	wordNodes,
	wordState,
	simple,
	snap,
	dt,
	time,
}: TokenAnimationContext) {
	const animateNode = (
		nodeKey: string,
		node: HTMLElement | undefined,
		p: number,
		isDot = false,
		letter = false,
	) => {
		if (!node) return;
		let set = springs.current.get(nodeKey);
		if (!set) {
			set = {
				scale: new Spring(
					isDot ? 0.75 : 0.95,
					isDot ? 0.7 : 0.88,
					isDot ? 0.6 : 0.64,
				),
				y: new Spring(isDot ? 0 : 0.01, isDot ? 1.25 : 1.45, 0.4),
				glow: new Spring(0, isDot ? 1 : 1.18, isDot ? 0.5 : 0.56),
				opacity: new Spring(isDot ? 0.35 : 1, 1, 0.5),
			};
			springs.current.set(nodeKey, set);
		}
		const scale = (
			isDot ? dotScaleSpline : letter ? letterScaleSpline : scaleSpline
		).at(p);
		const y = (
			isDot
				? dotYSpline
				: letter
					? simple
						? simpleLetterYSpline
						: letterYSpline
					: simple
						? simpleYSpline
						: ySpline
		).at(p);
		const glow = (isDot ? dotGlowSpline : glowSpline).at(p);
		const simpleWord = simple && !isDot && !letter;
		const simpleDot = simple && isDot;
		if (!simpleWord && !simpleDot) {
			set.scale.setGoal(scale, snap);
			set.glow.setGoal(glow, snap);
		}
		if (!simpleDot) set.y.setGoal(y, snap);
		set.opacity.setGoal(
			isDot
				? simple
					? simpleDotOpacitySpline.at(p)
					: dotOpacitySpline.at(p)
				: 1,
			snap,
		);
		const currentScale = simpleWord || simpleDot ? 1 : set.scale.step(dt);
		const currentY = simpleDot ? 0 : set.y.step(dt);
		const currentGlow = simpleWord || simpleDot ? 0 : set.glow.step(dt);
		// Spicy keeps translate and scale independent. Dots are 1.3× the
		// line font, but their vertical bounce is still measured against the
		// base lyric size, not their enlarged glyph size.
		node.style.transform = isDot
			? `translate3d(0, calc(var(--line-size) * ${currentY}), 0)`
			: `translate3d(0, ${currentY}em, 0)`;
		node.style.scale = String(currentScale);
		if (!isDot)
			node.style.setProperty(
				gradientProperty(simple),
				`${wordGradientAt(wordState, p, simple)}%`,
			);
		node.style.setProperty(
			"--shadow-blur",
			`${4 + (letter ? 12 : isDot ? 6 : 2) * currentGlow}px`,
		);
		node.style.setProperty(
			"--shadow-alpha",
			String(Math.min(1, currentGlow * (isDot ? 0.9 : letter ? 1 : 0.35))),
		);
		if (isDot) node.style.opacity = String(set.opacity.step(dt));
	};
	const animateHeldGroup = (
		nodeKey: string,
		node: HTMLElement | undefined,
		p: number,
	) => {
		if (!node) return;
		let set = springs.current.get(nodeKey);
		if (!set) {
			set = {
				scale: new Spring(0.95, 0.88, 0.64),
				y: new Spring(0.01, 1.45, 0.4),
				glow: new Spring(0, 1.18, 0.56),
				opacity: new Spring(1, 1, 0.5),
			};
			springs.current.set(nodeKey, set);
		}
		// SLM deliberately disables the normal word bounce and glow. Held
		// letters retain their own smaller proximity effects below.
		if (!simple) {
			set.scale.setGoal(scaleSpline.at(p), snap);
			set.glow.setGoal(glowSpline.at(p), snap);
		}
		set.y.setGoal((simple ? simpleYSpline : ySpline).at(p), snap);
		const currentScale = simple ? 1 : set.scale.step(dt);
		const currentY = set.y.step(dt);
		node.style.transform = `translateY(${currentY}em)`;
		node.style.scale = String(currentScale);
	};
	const animateHeldLetters = (
		word: SpicyToken,
		rootKey: string,
		groupState: "not-sung" | "active" | "sung",
	) => {
		if (!word.letters) return;
		const letterDuration =
			(word.endTime - word.startTime) / word.letters.length;
		const letterInfo = word.letters.map((_, index) => {
			const start = word.startTime + index * letterDuration;
			return { start, end: start + letterDuration };
		});
		const activeIndex =
			groupState === "active"
				? letterInfo.findIndex(
						({ start, end }) => stateAt(time, start, end) === "active",
					)
				: -1;
		const activeProgress =
			activeIndex === -1
				? 0
				: progressAt(
						time,
						letterInfo[activeIndex].start,
						letterInfo[activeIndex].end,
					);
		const letterScale = simple ? simpleLetterScaleSpline : letterScaleSpline;
		const letterY = simple ? simpleLetterYSpline : letterYSpline;
		for (let index = 0; index < letterInfo.length; index++) {
			const { start, end } = letterInfo[index];
			const nodeKey = `${rootKey}:${start}`;
			const node = wordNodes.current.get(nodeKey);
			if (!node) continue;
			let set = springs.current.get(nodeKey);
			if (!set) {
				set = {
					scale: new Spring(letterScale.at(0), 0.88, 0.64),
					y: new Spring(letterY.at(0), 1.45, 0.4),
					glow: new Spring(glowSpline.at(0), 1.18, 0.56),
					opacity: new Spring(1, 1, 0.5),
				};
				springs.current.set(nodeKey, set);
			}

			// Spicy has distinct whole-group branches: before a held word, every
			// letter rests; after it, every letter finishes at its sung value. The
			// per-letter proximity wave only runs while its group is active.
			const letterState =
				groupState === "active" ? stateAt(time, start, end) : groupState;
			let targetScale = letterScale.at(groupState === "sung" ? 1 : 0);
			let targetY = letterY.at(groupState === "sung" ? 1 : 0);
			let targetGlow = glowSpline.at(groupState === "sung" ? 1 : 0);
			if (groupState === "active" && activeIndex !== -1) {
				const progress = simple
					? progressAt(time, word.startTime, word.endTime)
					: activeProgress;
				const strength =
					word.endTime - word.startTime > 1500
						? { glow: 0.4, y: 0.45, scale: 1.103 }
						: { glow: 0.285, y: 0.1, scale: 1.09 };
				const baseScale =
					letterScale.at(progress) * (simple ? strength.scale : 1);
				const baseY = letterY.at(progress) * (simple ? strength.y : 1);
				const baseGlow = glowSpline.at(progress) * (simple ? strength.glow : 1);
				const distance = Math.abs(index - activeIndex);
				const falloff = 1 / (1 + distance ** 2.8);
				const glowFalloff = 1 / (1 + distance * 0.9);
				targetScale += (baseScale - targetScale) * falloff;
				targetY += (baseY - targetY) * falloff;
				targetGlow += (baseGlow - targetGlow) * glowFalloff;
			}
			if (groupState === "active" && letterState === "not-sung" && !simple) {
				targetScale = letterScale.at(0);
				targetY = letterY.at(0);
				targetGlow = glowSpline.at(0);
			} else if (
				groupState === "active" &&
				letterState === "sung" &&
				activeIndex === -1
			) {
				targetGlow = glowSpline.at(0.2);
			}
			set.scale.setGoal(targetScale, snap);
			set.y.setGoal(targetY, snap);
			set.glow.setGoal(targetGlow, snap);
			const currentScale = set.scale.step(dt);
			const currentY = set.y.step(dt);
			const currentGlow = set.glow.step(dt);
			const gradient =
				groupState === "sung"
					? 100
					: groupState === "not-sung"
						? simple
							? -50
							: -20
						: letterState === "sung"
							? 100
							: letterState === "active" && index === activeIndex
								? (simple ? -50 : -20) + 120 * easeSinOut(activeProgress)
								: simple
									? -50
									: -20;
			node.style.setProperty(gradientProperty(simple), `${gradient}%`);
			node.style.transform = `translateY(${currentY * 2}em)`;
			node.style.scale = String(currentScale);
			node.style.setProperty("--shadow-blur", `${4 + 12 * currentGlow}px`);
			node.style.setProperty(
				"--shadow-alpha",
				String(Math.min(1, currentGlow * 1.85)),
			);
		}
	};
	return { animateNode, animateHeldGroup, animateHeldLetters };
}
