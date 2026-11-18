# SoundTouch WASM attribution

`soundtouch.js`, `soundtouch.d.ts`, and `soundtouch_bg.wasm` are unmodified
artifacts copied from [AMLL TTML Tool](https://github.com/amll-dev/amll-ttml-tool)
revision `d4953b351ae073c1447464790fff17aa9bc1d807`, `src/modules/ffmpeg/worklet/wasm/`.
Upstream AMLL TTML Tool is GPL-3.0; see the repository root LICENSE.
Our player uses the worklet integration lessons in commits 67dfe255, 411465e7,
ff6af838, b850ee36, and 624c2667; it does not import upstream's streamed decoder.

The WASM embeds [apoint123/soundtouch-rs](https://github.com/apoint123/soundtouch-rs),
source revision `3e1b901` (embedded source paths), a Rust port of SoundTouch by
Olli Parviainen. The port declares GNU LGPL v2.1 in its README:
https://github.com/apoint123/soundtouch-rs#license
The original library's license is documented at
https://soundtouch.surina.net/README.html#license
A copy of LGPL v2.1 is included in LICENSE-LGPL-2.1.txt.

Corresponding port source: https://github.com/apoint123/soundtouch-rs/tree/3e1b901
Upstream build artifacts and their history: the pinned AMLL revision above.
The corresponding Rust WASM wrapper and build configuration are available in
[apoint123/ffmpeg-audio](https://github.com/apoint123/ffmpeg-audio/tree/945e5d69c563f40aa2cc221186394c2e22427e27/crates/soundtouch),
revision `945e5d69c563f40aa2cc221186394c2e22427e27` (the algorithm-selection update).
That wrapper repository is GPL-3.0; the underlying soundtouch-rs port is LGPL-2.1.

The generated bindings are deliberately kept byte-identical. The existing Biome
vendor exclusion applies; no suppressions were added.

# Signalsmith Stretch WASM attribution

`signalsmith-stretch.wasm` is the unmodified WebAssembly binary embedded (as
base64) in `SignalsmithStretch.mjs` of the `signalsmith-stretch` npm package,
version 1.3.2 (SHA-256 of the binary:
`83869197b3c5ebf9fc8c517a1586aef1ecf77404842218d62b9c0e82882d8ca3`).
Source: https://github.com/Signalsmith-Audio/signalsmith-stretch
Copyright (c) 2022 Geraint Luff / Signalsmith Audio Ltd., MIT License; a copy
is included in LICENSE-MIT-signalsmith.txt. Our loader is `../signalsmith.ts`,
which maps the build's minified export names.
