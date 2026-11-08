import argparse
import os
import subprocess
import sys

parser = argparse.ArgumentParser(description="Build, check, or lint wasm-spectrogram")
parser.add_argument(
    "--parallel", action="store_true", help="Enable multi-threading support"
)

group = parser.add_mutually_exclusive_group()
group.add_argument("--check", action="store_true", help="Run 'cargo check'")
group.add_argument("--clippy", action="store_true", help="Run 'cargo clippy'")

args = parser.parse_args()

is_cargo_cmd = args.check or args.clippy

if args.check:
    cmd = ["cargo", "check", "--target", "wasm32-unknown-unknown"]
elif args.clippy:
    cmd = ["cargo", "clippy", "--target", "wasm32-unknown-unknown"]
else:
    cmd = ["wasm-pack", "build", ".", "--target", "web"]

if args.parallel:
    rustflags = (
        "-C target-feature=+atomics,+bulk-memory,+mutable-globals "
        # needed in newer nightly toolchain
        # see https://github.com/rust-lang/rust/pull/147225
        "-C link-arg=--shared-memory "
        "-C link-arg=--max-memory=1073741824 "
        "-C link-arg=--import-memory "
        "-C link-arg=--export=__wasm_init_tls "
        "-C link-arg=--export=__tls_size "
        "-C link-arg=--export=__tls_align "
        "-C link-arg=--export=__tls_base "
        "-C link-arg=--export=__heap_base"
    )
    os.environ["RUSTFLAGS"] = f"{os.environ.get('RUSTFLAGS', '')} {rustflags}".strip()

    if not is_cargo_cmd:
        cmd.append("--")

    cmd.extend(["-Z", "build-std=std,panic_abort", "--features", "parallel"])

try:
    subprocess.run(cmd, check=True)
except subprocess.CalledProcessError:
    sys.exit(1)
