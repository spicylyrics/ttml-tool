import { afterEach, describe, expect, it, vi } from "vitest";

const save = vi.fn();
const writeTextFile = vi.fn();
const writeFile = vi.fn();
const saveFileFromLib = vi.fn();

vi.mock("@tauri-apps/plugin-dialog", () => ({ save }));
vi.mock("@tauri-apps/plugin-fs", () => ({ writeTextFile, writeFile }));
vi.mock("save-file", () => ({ default: saveFileFromLib }));

const TTML_TYPES = [
	{
		description: "TTML Files",
		accept: { "application/ttml+xml": [".ttml"] },
	},
];

async function load() {
	vi.resetModules();
	return (await import("./fileSystem")).saveFile;
}

afterEach(() => {
	vi.unstubAllEnvs();
	vi.clearAllMocks();
});

describe("saveFile in the desktop app", () => {
	it("asks with the native dialog and writes text to the chosen path", async () => {
		vi.stubEnv("TAURI_ENV_PLATFORM", "darwin");
		save.mockResolvedValue("/Users/me/Songs/Natalie.ttml");
		const saveFile = await load();

		const name = await saveFile("<tt/>", {
			suggestedName: "Song.ttml",
			types: TTML_TYPES,
		});

		expect(save).toHaveBeenCalledWith({
			defaultPath: "Song.ttml",
			filters: [{ name: "TTML Files", extensions: ["ttml"] }],
		});
		expect(writeTextFile).toHaveBeenCalledWith(
			"/Users/me/Songs/Natalie.ttml",
			"<tt/>",
		);
		expect(name).toBe("Natalie.ttml");
		expect(saveFileFromLib).not.toHaveBeenCalled();
	});

	it("writes a Blob as bytes", async () => {
		vi.stubEnv("TAURI_ENV_PLATFORM", "linux");
		save.mockResolvedValue("/home/me/backup.json");
		const saveFile = await load();

		await saveFile(new Blob(["{}"]), "backup.json");

		expect(writeFile).toHaveBeenCalledWith(
			"/home/me/backup.json",
			new Uint8Array([123, 125]),
		);
	});

	it("returns null and writes nothing when the dialog is cancelled", async () => {
		vi.stubEnv("TAURI_ENV_PLATFORM", "windows");
		save.mockResolvedValue(null);
		const saveFile = await load();

		expect(await saveFile("x", "a.ttml")).toBeNull();
		expect(writeTextFile).not.toHaveBeenCalled();
	});

	it("names Windows paths by their file name", async () => {
		vi.stubEnv("TAURI_ENV_PLATFORM", "windows");
		save.mockResolvedValue("C:\\Users\\me\\Song.ttml");
		const saveFile = await load();

		expect(await saveFile("x", "a.ttml")).toBe("Song.ttml");
	});
});
