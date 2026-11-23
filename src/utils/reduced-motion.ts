/** True when the OS asks for less motion. Read live, since users can change it any time. */
export const prefersReducedMotion = () =>
	typeof matchMedia === "function" &&
	matchMedia("(prefers-reduced-motion: reduce)").matches;
