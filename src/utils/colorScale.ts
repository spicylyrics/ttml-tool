/**
 * Utility to generate Radix UI-compatible 12-shade color scales from a single hex color.
 */

interface HSL {
	h: number;
	s: number;
	l: number;
}

function hexToHsl(hex: string): HSL {
	let r = 0,
		g = 0,
		b = 0;
	if (hex.length === 4) {
		r = Number.parseInt(hex[1] + hex[1], 16);
		g = Number.parseInt(hex[2] + hex[2], 16);
		b = Number.parseInt(hex[3] + hex[3], 16);
	} else {
		r = Number.parseInt(hex.slice(1, 3), 16);
		g = Number.parseInt(hex.slice(3, 5), 16);
		b = Number.parseInt(hex.slice(5, 7), 16);
	}
	r /= 255;
	g /= 255;
	b /= 255;
	const max = Math.max(r, g, b),
		min = Math.min(r, g, b);
	let h = 0,
		s = 0,
		l = (max + min) / 2;

	if (max !== min) {
		const d = max - min;
		s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
		switch (max) {
			case r:
				h = (g - b) / d + (g < b ? 6 : 0);
				break;
			case g:
				h = (b - r) / d + 2;
				break;
			case b:
				h = (r - g) / d + 4;
				break;
		}
		h /= 6;
	}
	return { h: h * 360, s: s * 100, l: l * 100 };
}

function hslToCss(h: number, s: number, l: number, a = 1): string {
	return `hsla(${Math.round(h)}, ${Math.round(s)}%, ${Math.round(l)}%, ${a})`;
}

function getContrastColor(l: number): string {
	return l > 65 ? "black" : "white";
}

export function generateRadixScale(
	baseHex: string,
	isDark?: boolean,
) {
	const { h, s, l: baseL } = hexToHsl(baseHex);
	const effectiveIsDark = isDark ?? baseL < 50;

	// Lightness presets for Radix-like 1-12 scale
	const lightnesses = effectiveIsDark
		? [
				2, // 1: App bg
				4, // 2: Subtle bg
				8, // 3: Item bg
				12, // 4: Item hover
				16, // 5: Item active
				24, // 6: Subtle border
				32, // 7: Border
				40, // 8: High contrast border
				Math.max(45, Math.min(85, baseL)), // 9: Solid (clamped base)
				Math.max(40, Math.min(80, baseL - 5)), // 10: Solid hover
				Math.max(65, Math.min(85, baseL + 15)), // 11: Low contrast text (Vivid)
				93, // 12: High contrast text (Slightly tinted near-white)
			]
		: [
				99, // 1: App bg
				97, // 2: Subtle bg
				93, // 3: Item bg
				89, // 4: Item hover
				84, // 5: Item active
				78, // 6: Subtle border
				71, // 7: Border
				70, // 8: High contrast border
				Math.max(25, Math.min(75, baseL)), // 9: Solid (clamped base)
				Math.max(20, Math.min(70, baseL - 5)), // 10: Solid hover
				Math.max(25, Math.min(45, baseL - 20)), // 11: Low contrast text (Vivid)
				8, // 12: High contrast text (Near-black)
			];

	// Custom alpha opacities to match Radix-like behavior
	const alphaOpacities = [
		0.05, // 1
		0.1,  // 2
		0.15, // 3: Soft background
		0.2,  // 4: Soft hover
		0.3,  // 5: Soft active
		0.45, // 6: Border
		0.6,  // 7: Higher contrast border
		0.8,  // 8: Solid border
		1.0,  // 9: Solid
		1.0,  // 10: Solid hover
		1.0,  // 11: Low contrast text
		1.0,  // 12: High contrast text
	];

	const variables: Record<string, string> = {
		"--accent-contrast": getContrastColor(lightnesses[8]),
		"--accent-9-contrast": getContrastColor(lightnesses[8]),
		"--accent-surface": hslToCss(h, s, baseL > 50 ? 98 : 15),
		"--accent-indicator": hslToCss(h, s, lightnesses[8]),
	};

	// Generate Accent Scale
	for (let i = 0; i < 12; i++) {
		const step = i + 1;
		const l = lightnesses[i];
		variables[`--accent-${step}`] = hslToCss(h, s, l);
		variables[`--accent-a${step}`] = hslToCss(h, s, l, alphaOpacities[i]);
	}

	// Generate Harmonious Gray Scale
	const greyH = h;
	const greyS = Math.max(5, Math.min(s, 50)); // Thematic saturation

	variables["--gray-surface"] = hslToCss(greyH, greyS, effectiveIsDark ? 10 : 99);

	for (let i = 0; i < 12; i++) {
		const step = i + 1;
		const l = lightnesses[i];
		variables[`--gray-${step}`] = hslToCss(greyH, greyS, l);
		variables[`--gray-a${step}`] = hslToCss(greyH, greyS, l, alphaOpacities[i]);
	}

	return variables;
}

/**
 * Generates a dual-tone linear gradient from a single hex color or a multi-stop gradient from multiple colors.
 */
export function generateGradient(
	baseHex: string | string[],
	type: "linear" | "radial" | "conic" = "linear",
	center: [number, number] = [50, 50],
	angle: number = 45,
	size: number = 1,
): string {
	const buildGradientString = (colorsStr: string) => {
		switch (type) {
			case "radial":
				return `radial-gradient(circle at ${center[0]}% ${center[1]}%, ${colorsStr})`;
			case "conic":
				return `conic-gradient(from ${angle}deg at ${center[0]}% ${center[1]}%, ${colorsStr})`;
			default:
				return `linear-gradient(${angle}deg, ${colorsStr})`;
		}
	};

	const getGradientString = (colorsArray: string[]) => {
		const numColors = Math.max(colorsArray.length - 1, 1);
		if (type === "conic") {
			const gap = (360 / numColors) * size;
			const stops = colorsArray.map((c, i) => `${c} ${i * gap}deg`).join(", ");
			return buildGradientString(stops);
		} else {
			const gap = (100 / numColors) * size;
			const stops = colorsArray.map((c, i) => `${c} ${i * gap}%`).join(", ");
			return buildGradientString(stops);
		}
	};

	if (Array.isArray(baseHex)) {
		if (baseHex.length === 0) return "";
		if (baseHex.length === 1) {
			const { h, s, l } = hexToHsl(baseHex[0]);
			const start = hslToCss(h, s, l);
			const end = hslToCss(h, s, Math.max(0, l - 30));
			return getGradientString([start, end]);
		}
		if (type === "conic" && baseHex.length > 2) {
			return getGradientString(baseHex);
		}
		return getGradientString(baseHex);
	}
	const { h, s, l } = hexToHsl(baseHex);
	const start = hslToCss(h, s, l);
	const end = hslToCss(h, s, Math.max(0, l - 30)); // 30% darker
	return getGradientString([start, end]);
}
