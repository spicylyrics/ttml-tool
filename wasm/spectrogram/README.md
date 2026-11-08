# Spectrogram renderer

Rust source for the WebAssembly module that draws the spectrogram tiles. The built files are committed in `src/modules/spectrogram/vendor/`, so the app builds without Rust; you only need this folder to change the renderer. Licensed under MIT (see `LICENSE`).

`generate_spectrogram_image(audio, palette, config)` returns RGBA pixels. `SpectrogramConfig` takes `sample_rate, fft_size, hop_length, img_width, img_height, gain, frequency_scale, max_freq`, where `frequency_scale` is `0` linear, `1` log (60 Hz to the top), `2` mel (0 Hz to the top), and `max_freq` is the wanted top in Hz. The top is the last whole FFT bin under `max_freq`, clamped to 20 kHz and Nyquist. Log and mel map rows in the value domain before the palette lookup: a row narrower than one bin interpolates between its two neighbouring bins, a wider row takes the loudest bin. Log and mel also lift the treble by 1.5 dB per octave above 500 Hz, applied to each bin's magnitude so silence stays black. Each pixel column takes the loudest of the STFT frames that fall in it, so zoomed-out tiles keep short peaks.

## Rebuild

Needs Rust nightly with `rust-src` and the `wasm32-unknown-unknown` target (`rust-toolchain.toml` sets this up), `wasm-pack`, and Python 3.

```bash
node scripts/build-spectrogram.mjs
```

That builds the serial and threaded variants and copies them into `src/modules/spectrogram/vendor/`. Run `cargo test` in this folder for the native tests.
