use std::hint::black_box;
use std::time::Duration;

use criterion::{Criterion, criterion_group, criterion_main};
use wasm_spectrogram::core::{FrequencyScale, SpectrogramConfig};
use wasm_spectrogram::native_api;

const SAMPLE_RATE: u32 = 48000;
const DURATION_SECONDS: u32 = 5;
const FFT_SIZE: usize = 1024;
const HOP_LENGTH: usize = 128;
const IMG_WIDTH: usize = 1024;
const IMG_HEIGHT: usize = 256;
const GAIN: f32 = 9.0;

fn generate_test_audio() -> Vec<f32> {
    let num_samples = (SAMPLE_RATE * DURATION_SECONDS) as usize;
    let freq = 440.0;
    (0..num_samples)
        .map(|i| {
            let t = i as f32 / SAMPLE_RATE as f32;
            (t * freq * 2.0 * std::f32::consts::PI).sin() * 0.5
        })
        .collect()
}

fn bench_generation(c: &mut Criterion) {
    let audio_data = generate_test_audio();

    let mut dummy_palette = vec![0u8; 256 * 4];
    for i in 0..256 {
        let val = i as u8;
        dummy_palette[i * 4] = val;
        dummy_palette[i * 4 + 1] = val;
        dummy_palette[i * 4 + 2] = val;
        dummy_palette[i * 4 + 3] = 255;
    }

    let config = SpectrogramConfig {
        sample_rate: SAMPLE_RATE,
        fft_size: FFT_SIZE,
        hop_length: HOP_LENGTH,
        img_width: IMG_WIDTH,
        img_height: IMG_HEIGHT,
        gain: GAIN,
        frequency_scale: FrequencyScale::Linear,
        max_freq: 20000.0,
    };

    let mut group = c.benchmark_group("Spectrogram");
    group.sample_size(10);

    group.warm_up_time(Duration::from_millis(1));

    group.bench_function("generate_native", |b| {
        b.iter(|| {
            native_api::generate_spectrogram_image_native(
                black_box(&audio_data),
                black_box(&dummy_palette),
                black_box(config),
            )
            .unwrap();
        });
    });

    group.finish();
}

criterion_group!(benches, bench_generation);
criterion_main!(benches);
