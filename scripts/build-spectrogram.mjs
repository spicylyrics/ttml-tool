#!/usr/bin/env node
// Rebuilds the spectrogram renderer (wasm/spectrogram) and copies the serial
// and threaded builds into src/modules/spectrogram/vendor. Needs Rust nightly,
// wasm-pack and Python 3; the app itself builds from the committed files.
import { spawnSync } from "node:child_process";
import { cpSync, existsSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const crate = join(root, "wasm", "spectrogram");
const vendor = join(root, "src", "modules", "spectrogram", "vendor");
const files = [
	"wasm_spectrogram.js",
	"wasm_spectrogram.d.ts",
	"wasm_spectrogram_bg.wasm",
	"wasm_spectrogram_bg.wasm.d.ts",
];

function build(parallel) {
	const python = process.platform === "win32" ? "python" : "python3";
	const args = ["build.py", ...(parallel ? ["--parallel"] : [])];
	const result = spawnSync(python, args, { cwd: crate, stdio: "inherit" });
	if (result.status !== 0) {
		console.error(
			`Spectrogram ${parallel ? "threaded" : "serial"} build failed.`,
		);
		process.exit(result.status ?? 1);
	}
}

function copyBuild(target) {
	const pkg = join(crate, "pkg");
	for (const file of files) cpSync(join(pkg, file), join(target, file));
}

// Serial first, then threaded, since both write to pkg/.
build(false);
copyBuild(join(vendor, "serial"));
build(true);
copyBuild(vendor);
const snippets = join(crate, "pkg", "snippets");
if (existsSync(snippets)) {
	rmSync(join(vendor, "snippets"), { recursive: true, force: true });
	cpSync(snippets, join(vendor, "snippets"), { recursive: true });
}
console.log("Spectrogram builds copied to src/modules/spectrogram/vendor.");
