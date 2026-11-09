import { describe, expect, it } from "vitest";
import {
	KEYBINDING_DEFAULTS_VERSION_KEY,
	type KeyBindingDefaultChange,
	migrateKeyBindingDefaults,
} from "./default-migrations";

function memoryStorage(entries: Record<string, string> = {}) {
	const data = new Map(Object.entries(entries));
	return {
		data,
		get length() {
			return data.size;
		},
		key: (index: number) => [...data.keys()][index] ?? null,
		getItem: (name: string) => data.get(name) ?? null,
		setItem: (name: string, value: string) => void data.set(name, value),
	};
}

const changes: KeyBindingDefaultChange[] = [
	{ version: 1, previous: { audition: ["KeyB"], movePlay: ["KeyR"] } },
	{ version: 2, previous: { audition: ["KeyX"], sync: ["KeyF"] } },
];

describe("keybinding default migration", () => {
	it("gives a new install the new defaults", () => {
		const storage = memoryStorage({ i18nextLng: '"en-US"' });
		migrateKeyBindingDefaults(storage, changes);
		expect([...storage.data.keys()]).toEqual([
			"i18nextLng",
			KEYBINDING_DEFAULTS_VERSION_KEY,
		]);
		expect(storage.getItem(KEYBINDING_DEFAULTS_VERSION_KEY)).toBe("2");
	});

	it("keeps an existing user's old defaults and their own keys", () => {
		const storage = memoryStorage({
			lastSeenAppVersion: "0.24.0",
			"keybindings:movePlay": '["KeyP"]',
		});
		migrateKeyBindingDefaults(storage, changes);
		expect(storage.getItem("keybindings:audition")).toBe('["KeyB"]');
		expect(storage.getItem("keybindings:movePlay")).toBe('["KeyP"]');
		expect(storage.getItem("keybindings:sync")).toBe('["KeyF"]');
	});

	it("applies only newer changes to someone already migrated", () => {
		const storage = memoryStorage({ [KEYBINDING_DEFAULTS_VERSION_KEY]: "1" });
		migrateKeyBindingDefaults(storage, changes);
		expect(storage.getItem("keybindings:audition")).toBe('["KeyX"]');
		expect(storage.getItem("keybindings:sync")).toBe('["KeyF"]');
		expect(storage.getItem("keybindings:movePlay")).toBeNull();
		expect(storage.getItem(KEYBINDING_DEFAULTS_VERSION_KEY)).toBe("2");
	});

	it("runs once", () => {
		const storage = memoryStorage({ lastSeenAppVersion: "0.24.0" });
		migrateKeyBindingDefaults(storage, changes);
		storage.data.delete("keybindings:audition");
		migrateKeyBindingDefaults(storage, changes);
		expect(storage.getItem("keybindings:audition")).toBeNull();
	});
});
