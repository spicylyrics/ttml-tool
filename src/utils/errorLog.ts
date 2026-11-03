// The last few errors this session, for problem reports. Kept in memory only.

const LIMIT = 20;

export interface LoggedError {
	time: Date;
	message: string;
}

const errors: LoggedError[] = [];
let started = false;

const describe = (value: unknown): string => {
	if (value instanceof Error) return `${value.name}: ${value.message}`;
	if (typeof value === "string") return value;
	try {
		return JSON.stringify(value) ?? String(value);
	} catch {
		return String(value);
	}
};

export function recordError(...parts: unknown[]) {
	const message = parts.map(describe).join(" ").replace(/\s+/g, " ").trim();
	if (!message) return;
	errors.push({ time: new Date(), message: message.slice(0, 500) });
	if (errors.length > LIMIT) errors.splice(0, errors.length - LIMIT);
}

export const recentErrors = (): readonly LoggedError[] => [...errors];

/** Starts collecting console errors and uncaught errors. Safe to call twice. */
export function startErrorLog() {
	if (started) return;
	started = true;
	const original = console.error.bind(console);
	console.error = (...args: unknown[]) => {
		recordError(...args);
		original(...args);
	};
	window.addEventListener("error", (event) =>
		recordError(event.error ?? event.message),
	);
	window.addEventListener("unhandledrejection", (event) =>
		recordError("Unhandled rejection:", event.reason),
	);
}

/** For tests. */
export function clearErrorLog() {
	errors.length = 0;
}
