use cfg_if::cfg_if;
use thiserror::Error;

pub mod core {
    use super::{Error, cfg_if};
    use realfft::num_complex::Complex;
    use realfft::{RealFftPlanner, RealToComplex};
    use std::mem::MaybeUninit;

    #[derive(Debug, Clone, Copy)]
    pub struct SpectrogramConfig {
        pub sample_rate: u32,
        pub fft_size: usize,
        pub hop_length: usize,
        pub img_width: usize,
        pub img_height: usize,
        pub gain: f32,
        pub frequency_scale: FrequencyScale,
    }

    #[derive(Error, Debug, Clone, PartialEq, Eq)]
    pub enum SpectrogramError {
        #[error("Audio data is too short to produce a spectrogram.")]
        AudioTooShort,
        #[error("The number of frequency bins is zero, cannot process.")]
        NoFrequencyBins,
        #[error("Unknown frequency scale {0} (expected 0 = linear, 1 = log, 2 = mel).")]
        InvalidFrequencyScale(u32),
    }

    /// 纵轴的频率刻度。
    #[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
    pub enum FrequencyScale {
        /// 原有的 Aegisub 式映射（线性与对数按 `log_ratio` 混合），输出与以前逐字节相同。
        #[default]
        Linear,
        /// 从 [`LOG_BOTTOM_FREQ`] 到顶部频率的对数刻度。
        Log,
        /// 从 0 Hz 到顶部频率的 mel 刻度。
        Mel,
    }

    /// 对数刻度的底部频率（Hz）。对数刻度无法从 0 开始，而人声基本不会低于 80 Hz。
    pub const LOG_BOTTOM_FREQ: f32 = 60.0;

    #[must_use]
    pub fn hz_to_mel(freq: f32) -> f32 {
        2595.0 * (1.0 + freq / 700.0).log10()
    }

    #[must_use]
    pub fn mel_to_hz(mel: f32) -> f32 {
        700.0 * (10.0_f32.powf(mel / 2595.0) - 1.0)
    }

    impl FrequencyScale {
        /// JS 侧的编号：0 = linear，1 = log，2 = mel。
        pub const fn from_u32(value: u32) -> Result<Self, SpectrogramError> {
            match value {
                0 => Ok(Self::Linear),
                1 => Ok(Self::Log),
                2 => Ok(Self::Mel),
                other => Err(SpectrogramError::InvalidFrequencyScale(other)),
            }
        }

        /// 该刻度的底部频率（Hz）。
        #[must_use]
        pub const fn bottom_freq(self) -> f32 {
            match self {
                Self::Linear | Self::Mel => 0.0,
                Self::Log => LOG_BOTTOM_FREQ,
            }
        }

        /// 把相对高度 `pos`（0 = 底部，1 = 顶部）映射到频率（Hz）。
        ///
        /// `Linear` 在这里是纯线性的 0..top；实际渲染的线性路径仍沿用
        /// [`calculate_log_ratio`] 的旧映射，以保持输出不变。
        #[must_use]
        pub fn freq_at(self, pos: f32, top_freq: f32) -> f32 {
            // 顶部频率低于底部（采样率极低）时退化为常数，避免轴反转或 NaN。
            let bottom = self.bottom_freq().min(top_freq);
            match self {
                Self::Linear => bottom + pos * (top_freq - bottom),
                Self::Log => bottom * (pos * (top_freq / bottom).ln()).exp(),
                Self::Mel => {
                    let mel_bottom = hz_to_mel(bottom);
                    mel_to_hz(mel_bottom + pos * (hz_to_mel(top_freq) - mel_bottom))
                }
            }
        }

        /// 第 `y` 行（0 = 底部）下边缘和上边缘对应的频率（Hz）。
        #[must_use]
        pub fn row_freq_edges(self, y: usize, img_height: usize, top_freq: f32) -> (f32, f32) {
            let height = img_height as f32;
            (
                self.freq_at(y as f32 / height, top_freq),
                self.freq_at((y + 1) as f32 / height, top_freq),
            )
        }
    }

    /// 分配未初始化元素；调用方必须在读取前写入全部元素。
    fn uninit_vec<T>(len: usize) -> Vec<MaybeUninit<T>> {
        let mut values = Vec::with_capacity(len);
        // SAFETY: MaybeUninit<T> 允许未初始化；容量已经足够。
        unsafe { values.set_len(len) };
        values
    }

    /// # Safety
    /// `values` 的每个元素都必须已经初始化。
    unsafe fn assume_init_vec<T>(mut values: Vec<MaybeUninit<T>>) -> Vec<T> {
        let pointer = values.as_mut_ptr().cast::<T>();
        let length = values.len();
        let capacity = values.capacity();
        std::mem::forget(values);
        // SAFETY: 调用方保证全部元素已初始化；MaybeUninit<T> 与 T 布局相同。
        unsafe { Vec::from_raw_parts(pointer, length, capacity) }
    }

    pub fn calculate_spectrogram(
        audio_data: &[f32],
        fft: &dyn RealToComplex<f32>,
        fft_size: usize,
        hop_length: usize,
        num_freq_bins_to_render: usize,
    ) -> (Vec<f32>, usize) {
        let num_time_bins = if audio_data.len() >= fft_size {
            (audio_data.len() - fft_size) / hop_length + 1
        } else {
            0
        };
        if num_time_bins == 0 {
            return (Vec::new(), 0);
        }

        struct SpectrogramProcessor<'a> {
            fft: &'a dyn RealToComplex<f32>,
            audio_data: &'a [f32],
            fft_size: usize,
            hop_length: usize,
            num_freq_bins_to_render: usize,
        }

        impl SpectrogramProcessor<'_> {
            fn process_time_bin(
                &self,
                time_index: usize,
                time_bin_slice: &mut [MaybeUninit<f32>],
                real_input: &mut [f32],
                complex_output: &mut [Complex<f32>],
            ) {
                let current_pos = time_index * self.hop_length;
                let audio_chunk = &self.audio_data[current_pos..current_pos + self.fft_size];

                real_input.copy_from_slice(audio_chunk);
                self.fft.process(real_input, complex_output).unwrap();

                #[expect(clippy::imprecise_flops)]
                time_bin_slice
                    .iter_mut()
                    .zip(complex_output[0..self.num_freq_bins_to_render].iter())
                    .for_each(|(mag_slot, complex_val)| {
                        mag_slot.write(
                            (complex_val.re * complex_val.re + complex_val.im * complex_val.im)
                                .sqrt(),
                        );
                    });
            }
        }

        let processor = SpectrogramProcessor {
            fft,
            audio_data,
            fft_size,
            hop_length,
            num_freq_bins_to_render,
        };

        let mut flat_spectrogram = uninit_vec::<f32>(num_time_bins * num_freq_bins_to_render);

        cfg_if! {
            if #[cfg(feature = "parallel")] {
                use rayon::prelude::*;

                flat_spectrogram
                    .par_chunks_mut(num_freq_bins_to_render)
                    .enumerate()
                    .for_each_init(
                        || (fft.make_input_vec(), fft.make_output_vec()),
                        |buffers, (i, time_bin_slice)| {
                            processor.process_time_bin(i, time_bin_slice, &mut buffers.0, &mut buffers.1);
                        },
                    );
            } else {
                let mut real_input = fft.make_input_vec();
                let mut complex_output = fft.make_output_vec();

                flat_spectrogram
                    .chunks_mut(num_freq_bins_to_render)
                    .enumerate()
                    .for_each(|(i, time_bin_slice)| {
                        processor.process_time_bin(i, time_bin_slice, &mut real_input, &mut complex_output);
                    });
            }
        }

        // SAFETY: process_time_bin 会写满每个 time bin 的所有频点。
        let flat_spectrogram = unsafe { assume_init_vec(flat_spectrogram) };
        (flat_spectrogram, num_time_bins)
    }

    pub fn apply_gain_mapping(spectrogram: &mut [f32], fft_size: usize, gain: f32) {
        let n = fft_size as f32;
        let scale_factor = 9.0 / (2.0 * n).sqrt();

        // A real log10. The old bit-trick log2 was exact only at powers of two
        // and linear in between, so its slope doubled and halved every 6 dB,
        // which drew contour rings inside smooth bright areas.
        let mapping_op = |v: &mut f32| {
            *v = (*v * scale_factor + 1.0).log10() * gain;
        };

        cfg_if! {
            if #[cfg(feature = "parallel")] {
                use rayon::prelude::*;
                spectrogram.par_iter_mut().for_each(mapping_op);
            } else {
                spectrogram.iter_mut().for_each(mapping_op);
            }
        }
    }

    pub struct RenderableSpectrogram {
        pub values: Vec<f32>,
        pub num_time_bins: usize,
        pub num_freq_bins: usize,
        /// 每个 FFT 频点的宽度（Hz），即 `sample_rate / fft_size`。
        pub freq_resolution: f32,
    }

    impl RenderableSpectrogram {
        /// 图像顶部对应的频率（Hz）。
        #[must_use]
        pub fn top_freq(&self) -> f32 {
            self.num_freq_bins as f32 * self.freq_resolution
        }
    }

    pub fn process_audio_to_spectrogram(
        audio_data: &[f32],
        sample_rate: u32,
        fft_size: usize,
        hop_length: usize,
        gain: f32,
    ) -> Result<RenderableSpectrogram, SpectrogramError> {
        let mut planner = RealFftPlanner::new();
        let fft = planner.plan_fft_forward(fft_size);
        let max_freq = 20000.0;
        let freq_resolution = sample_rate as f32 / fft_size as f32;
        let num_freq_bins = (max_freq / freq_resolution).round() as usize;
        let num_freq_bins = num_freq_bins.min(fft_size / 2);

        if num_freq_bins == 0 {
            return Err(SpectrogramError::NoFrequencyBins);
        }

        let (mut values, num_time_bins) =
            calculate_spectrogram(audio_data, &*fft, fft_size, hop_length, num_freq_bins);

        if num_time_bins == 0 {
            return Err(SpectrogramError::AudioTooShort);
        }

        apply_gain_mapping(&mut values, fft_size, gain);

        Ok(RenderableSpectrogram {
            values,
            num_time_bins,
            num_freq_bins,
            freq_resolution,
        })
    }

    /// 一行像素从哪些 FFT 频点取值。
    #[derive(Debug, Clone, Copy, PartialEq)]
    pub enum RowSpan {
        /// 只有直流分量可画：整行用调色板第一个颜色。
        Blank,
        /// 取 `start..end` 频点中的最大值（`end > start`）。
        Max { start: usize, end: usize },
        /// 在 `lower` 与 `upper` 两个频点之间按 `t` 线性插值（值域插值，不插颜色）。
        Lerp { lower: usize, upper: usize, t: f32 },
    }

    /// 计算第 `y_logical` 行（0 = 底部）的取值方式。
    ///
    /// `log_ratio` 只对 `Linear` 生效。
    #[must_use]
    pub fn row_span(
        y_logical: usize,
        img_height: usize,
        num_freq_bins: usize,
        freq_resolution: f32,
        scale: FrequencyScale,
        log_ratio: f32,
    ) -> RowSpan {
        if num_freq_bins <= 1 {
            return RowSpan::Blank;
        }
        match scale {
            FrequencyScale::Linear => {
                linear_row_span(y_logical, img_height, num_freq_bins, log_ratio)
            }
            FrequencyScale::Log | FrequencyScale::Mel => {
                let top_freq = num_freq_bins as f32 * freq_resolution;
                let (low_freq, high_freq) = scale.row_freq_edges(y_logical, img_height, top_freq);
                scaled_row_span(
                    low_freq / freq_resolution,
                    high_freq / freq_resolution,
                    num_freq_bins,
                )
            }
        }
    }

    /// 原有的线性映射，保持与改动前逐字节一致。
    fn linear_row_span(
        y_logical: usize,
        img_height: usize,
        num_freq_bins: usize,
        log_ratio: f32,
    ) -> RowSpan {
        let min_bin_f = 1.0_f32;
        let max_bin_f = num_freq_bins as f32;
        let scale_log = (max_bin_f / min_bin_f).ln();

        let map_y_to_bin = |y: usize| -> f32 {
            let pos_rel = y as f32 / img_height as f32;
            let b_lin = pos_rel * (max_bin_f - min_bin_f) + min_bin_f;
            let b_log = min_bin_f * (pos_rel * scale_log).exp();
            log_ratio * (b_log - b_lin) + b_lin
        };

        let start = (map_y_to_bin(y_logical).floor() as usize).min(num_freq_bins - 1);
        let end = (map_y_to_bin(y_logical + 1).floor() as usize).min(num_freq_bins);

        // 不足一个频点时取 start 处的单个频点。
        RowSpan::Max {
            start,
            end: end.max(start + 1),
        }
    }

    /// 对数 / mel 刻度：行的上下边缘已换算成小数频点 `low_bin..high_bin`。
    ///
    /// 频点 k 的中心在 k × freq_resolution。行宽不少于一个频点时，取中心落在
    /// `[low_bin, high_bin)` 内的频点最大值（每个频点恰好属于一行）；
    /// 不足一个频点时，在行中心频率处对相邻两个频点做线性插值。
    fn scaled_row_span(low_bin: f32, high_bin: f32, num_freq_bins: usize) -> RowSpan {
        let last_bin = num_freq_bins - 1;
        if high_bin - low_bin >= 1.0 {
            let start = (low_bin.ceil().max(0.0) as usize).min(last_bin);
            let end = (high_bin.ceil().max(0.0) as usize).clamp(start + 1, num_freq_bins);
            RowSpan::Max { start, end }
        } else {
            let center = f32::midpoint(low_bin, high_bin).max(0.0);
            let lower = (center.floor() as usize).min(last_bin);
            let upper = (lower + 1).min(last_bin);
            let t = (center - lower as f32).clamp(0.0, 1.0);
            RowSpan::Lerp { lower, upper, t }
        }
    }

    pub fn render_pixel_row(
        span: RowSpan,
        spectrogram: &RenderableSpectrogram,
        row_buffer: &mut [MaybeUninit<u8>],
        palette: &[u8],
        time_indices: &[u32],
    ) {
        let (pixel_chunks, _) = row_buffer.as_chunks_mut::<4>();
        let num_freq_bins = spectrogram.num_freq_bins;
        let time_bins = || {
            time_indices.iter().map(|&time_index| {
                let start = time_index as usize * num_freq_bins;
                &spectrogram.values[start..start + num_freq_bins]
            })
        };

        // 每种取值方式各自一个循环，避免在每个像素上分支。
        match span {
            RowSpan::Blank => {
                let color = &palette[0..4];
                for pixel_chunk in pixel_chunks {
                    write_color(pixel_chunk, color);
                }
            }
            RowSpan::Max { start, end } => {
                for (time_bin, pixel_chunk) in time_bins().zip(pixel_chunks.iter_mut()) {
                    let final_value = time_bin[start..end]
                        .iter()
                        .copied()
                        .fold(f32::NEG_INFINITY, |a, b| if a > b { a } else { b });
                    write_color(pixel_chunk, palette_color(palette, final_value));
                }
            }
            RowSpan::Lerp { lower, upper, t } => {
                for (time_bin, pixel_chunk) in time_bins().zip(pixel_chunks.iter_mut()) {
                    let low = time_bin[lower];
                    let final_value = low + (time_bin[upper] - low) * t;
                    write_color(pixel_chunk, palette_color(palette, final_value));
                }
            }
        }
    }

    #[inline]
    fn palette_color(palette: &[u8], value: f32) -> &[u8] {
        let color_index = (value.clamp(0.0, 1.0) * 255.0 + 0.5) as usize;
        let color_start_index = color_index * 4;

        if color_start_index + 4 <= palette.len() {
            &palette[color_start_index..color_start_index + 4]
        } else {
            &palette[0..4]
        }
    }

    /// 把 4 字节颜色写入未初始化的像素块。
    fn write_color(destination: &mut [MaybeUninit<u8>; 4], color: &[u8]) {
        debug_assert!(color.len() >= 4);
        // SAFETY: destination 有 4 个可写字节，color 至少有 4 个可读字节。
        unsafe {
            std::ptr::copy_nonoverlapping(color.as_ptr(), destination.as_mut_ptr().cast::<u8>(), 4);
        }
    }

    #[must_use]
    pub fn render_pixels(
        spectrogram: &RenderableSpectrogram,
        img_width: usize,
        img_height: usize,
        scale: FrequencyScale,
        log_ratio: f32,
        palette: &[u8],
    ) -> Vec<u8> {
        if img_width == 0 || img_height == 0 {
            return Vec::new();
        }

        let time_ratio = (spectrogram.num_time_bins - 1) as f32 / img_width as f32;
        let time_indices: Vec<u32> = (0..img_width)
            .map(|x| ((x as f32) * time_ratio + 0.5) as u32)
            .collect();
        let span_for_pixel_row = |y_pixel: usize| {
            row_span(
                img_height - 1 - y_pixel,
                img_height,
                spectrogram.num_freq_bins,
                spectrogram.freq_resolution,
                scale,
                log_ratio,
            )
        };
        let mut pixels = uninit_vec::<u8>(img_width * img_height * 4);

        cfg_if! {
            if #[cfg(feature = "parallel")] {
                use rayon::prelude::*;
                pixels
                    .par_chunks_mut(img_width * 4)
                    .enumerate()
                    .for_each(|(y_pixel, row_slice)| {
                        render_pixel_row(
                            span_for_pixel_row(y_pixel),
                            spectrogram,
                            row_slice,
                            palette,
                            &time_indices,
                        );
                    });
            } else {
                for (y_pixel, row_buffer) in pixels.chunks_mut(img_width * 4).enumerate() {
                    render_pixel_row(
                        span_for_pixel_row(y_pixel),
                        spectrogram,
                        row_buffer,
                        palette,
                        &time_indices,
                    );
                }
            }
        }
        // SAFETY: render_pixel_row 写满每一行的每个像素的 4 个字节。
        unsafe { assume_init_vec(pixels) }
    }

    const LOG_RATIO_POS_FREF: f32 = 0.001;
    const LOG_RATIO_FREQ_REF: f32 = 1000.0;

    #[must_use]
    pub fn calculate_log_ratio(
        sample_rate: u32,
        fft_size: usize,
        img_height: usize,
        num_freq_bins: usize,
    ) -> f32 {
        let min_bin = 1;
        let max_bin = num_freq_bins;

        if max_bin <= min_bin || img_height == 0 {
            return 0.0;
        }

        let freq_resolution = sample_rate as f32 / fft_size as f32;
        let b_fref =
            (LOG_RATIO_FREQ_REF / freq_resolution).clamp(min_bin as f32, (max_bin - 1) as f32);

        let min_bin_f = min_bin as f32;
        let max_bin_f = max_bin as f32;

        let clin = (max_bin_f - min_bin_f) * LOG_RATIO_POS_FREF + min_bin_f;
        let scale_log = (max_bin_f / min_bin_f).ln();
        let clog = min_bin_f * (LOG_RATIO_POS_FREF * scale_log).exp();

        let denominator = clog - clin;
        if denominator.abs() < 1e-6 {
            0.5
        } else {
            ((b_fref - clin) / denominator).clamp(0.0, 1.0)
        }
    }
}

#[cfg(target_arch = "wasm32")]
pub mod wasm_api {
    use super::core::{self, SpectrogramError};
    use wasm_bindgen::prelude::*;

    impl From<SpectrogramError> for JsValue {
        fn from(err: SpectrogramError) -> Self {
            js_sys::Error::new(&err.to_string()).into()
        }
    }

    #[cfg(feature = "parallel")]
    #[wasm_bindgen]
    pub fn init_thread_pool(num_threads: usize) -> js_sys::Promise {
        wasm_bindgen_rayon::init_thread_pool(num_threads)
    }

    #[wasm_bindgen]
    pub struct SpectrogramConfig {
        pub sample_rate: u32,
        pub fft_size: usize,
        pub hop_length: usize,
        pub img_width: usize,
        pub img_height: usize,
        pub gain: f32,
        /// 0 = linear，1 = log，2 = mel。
        pub frequency_scale: u32,
    }

    #[wasm_bindgen]
    impl SpectrogramConfig {
        #[wasm_bindgen(constructor)]
        #[must_use]
        #[allow(clippy::missing_const_for_fn)]
        pub fn new(
            sample_rate: u32,
            fft_size: usize,
            hop_length: usize,
            img_width: usize,
            img_height: usize,
            gain: f32,
            frequency_scale: u32,
        ) -> Self {
            Self {
                sample_rate,
                fft_size,
                hop_length,
                img_width,
                img_height,
                gain,
                frequency_scale,
            }
        }
    }

    #[wasm_bindgen]
    pub fn generate_spectrogram_image(
        audio_data: &[f32],
        palette: &[u8],
        config: &SpectrogramConfig,
    ) -> Result<Vec<u8>, JsValue> {
        let frequency_scale = core::FrequencyScale::from_u32(config.frequency_scale)?;
        let spectrogram_data = core::process_audio_to_spectrogram(
            audio_data,
            config.sample_rate,
            config.fft_size,
            config.hop_length,
            config.gain,
        )?;

        let log_ratio = core::calculate_log_ratio(
            config.sample_rate,
            config.fft_size,
            config.img_height,
            spectrogram_data.num_freq_bins,
        );

        Ok(core::render_pixels(
            &spectrogram_data,
            config.img_width,
            config.img_height,
            frequency_scale,
            log_ratio,
            palette,
        ))
    }
}

#[cfg(not(target_arch = "wasm32"))]
pub mod native_api {
    use super::core::{self, SpectrogramConfig, SpectrogramError};

    pub fn generate_spectrogram_image_native(
        audio_data: &[f32],
        palette: &[u8],
        config: SpectrogramConfig,
    ) -> Result<Vec<u8>, SpectrogramError> {
        let spectrogram_data = core::process_audio_to_spectrogram(
            audio_data,
            config.sample_rate,
            config.fft_size,
            config.hop_length,
            config.gain,
        )?;

        let log_ratio = core::calculate_log_ratio(
            config.sample_rate,
            config.fft_size,
            config.img_height,
            spectrogram_data.num_freq_bins,
        );

        Ok(core::render_pixels(
            &spectrogram_data,
            config.img_width,
            config.img_height,
            config.frequency_scale,
            log_ratio,
            palette,
        ))
    }
}

#[cfg(all(test, not(target_arch = "wasm32")))]
mod tests {
    use super::core::{self, FrequencyScale, RowSpan, SpectrogramConfig, SpectrogramError};
    use super::native_api;

    const SAMPLE_RATE: u32 = 48000;
    const DURATION_SECONDS: u32 = 1;
    const FFT_SIZE: usize = 1024;
    const HOP_LENGTH: usize = 128;
    const IMG_WIDTH: usize = 1024;
    const IMG_HEIGHT: usize = 256;
    const GAIN: f32 = 9.0;

    fn generate_tone(freq: f32) -> Vec<f32> {
        let num_samples = (SAMPLE_RATE * DURATION_SECONDS) as usize;
        (0..num_samples)
            .map(|i| {
                let t = i as f32 / SAMPLE_RATE as f32;
                (t * freq * 2.0 * std::f32::consts::PI).sin() * 0.5
            })
            .collect()
    }

    fn generate_test_audio() -> Vec<f32> {
        generate_tone(440.0)
    }

    fn grey_palette() -> Vec<u8> {
        (0..=255u8).flat_map(|v| [v, v, v, 255]).collect()
    }

    const fn config(
        img_height: usize,
        gain: f32,
        frequency_scale: FrequencyScale,
    ) -> SpectrogramConfig {
        SpectrogramConfig {
            sample_rate: SAMPLE_RATE,
            fft_size: FFT_SIZE,
            hop_length: HOP_LENGTH,
            img_width: IMG_WIDTH,
            img_height,
            gain,
            frequency_scale,
        }
    }

    /// 加入频率刻度之前（提交 0abbbdb）的渲染逻辑原样保留，用来逐字节核对线性路径。
    fn reference_linear_render(
        spectrogram: &core::RenderableSpectrogram,
        img_width: usize,
        img_height: usize,
        log_ratio: f32,
        palette: &[u8],
    ) -> Vec<u8> {
        let time_ratio = (spectrogram.num_time_bins - 1) as f32 / img_width as f32;
        let time_indices: Vec<u32> = (0..img_width)
            .map(|x| ((x as f32) * time_ratio + 0.5) as u32)
            .collect();
        let mut pixels = Vec::with_capacity(img_width * img_height * 4);

        let min_bin_f = 1.0_f32;
        let max_bin_f = spectrogram.num_freq_bins as f32;
        let scale_log = (max_bin_f / min_bin_f).ln();
        let map_y_to_bin = |y: usize| -> f32 {
            let pos_rel = y as f32 / img_height as f32;
            let b_lin = pos_rel * (max_bin_f - min_bin_f) + min_bin_f;
            let b_log = min_bin_f * (pos_rel * scale_log).exp();
            log_ratio * (b_log - b_lin) + b_lin
        };

        for y_pixel in 0..img_height {
            let y_logical = img_height - 1 - y_pixel;
            let bin_start =
                (map_y_to_bin(y_logical).floor() as usize).min(spectrogram.num_freq_bins - 1);
            let bin_end =
                (map_y_to_bin(y_logical + 1).floor() as usize).min(spectrogram.num_freq_bins);
            for &time_index in &time_indices {
                let offset = time_index as usize * spectrogram.num_freq_bins;
                let time_bin = &spectrogram.values[offset..offset + spectrogram.num_freq_bins];
                let final_value = if bin_start >= bin_end {
                    time_bin[bin_start.min(time_bin.len().saturating_sub(1))]
                } else {
                    time_bin[bin_start..bin_end]
                        .iter()
                        .copied()
                        .fold(f32::NEG_INFINITY, |a, b| if a > b { a } else { b })
                };
                let color_start = (final_value.clamp(0.0, 1.0) * 255.0 + 0.5) as usize * 4;
                let color = if color_start + 4 <= palette.len() {
                    &palette[color_start..color_start + 4]
                } else {
                    &palette[0..4]
                };
                pixels.extend_from_slice(color);
            }
        }
        pixels
    }

    #[test]
    fn test_generation_does_not_panic() {
        let audio_data = generate_test_audio();
        for scale in [
            FrequencyScale::Linear,
            FrequencyScale::Log,
            FrequencyScale::Mel,
        ] {
            let pixels = native_api::generate_spectrogram_image_native(
                &audio_data,
                &grey_palette(),
                config(IMG_HEIGHT, GAIN, scale),
            )
            .unwrap();
            assert_eq!(pixels.len(), IMG_WIDTH * IMG_HEIGHT * 4);
        }
    }

    #[test]
    fn frequency_scale_from_u32() {
        assert_eq!(FrequencyScale::from_u32(0), Ok(FrequencyScale::Linear));
        assert_eq!(FrequencyScale::from_u32(1), Ok(FrequencyScale::Log));
        assert_eq!(FrequencyScale::from_u32(2), Ok(FrequencyScale::Mel));
        assert_eq!(
            FrequencyScale::from_u32(3),
            Err(SpectrogramError::InvalidFrequencyScale(3))
        );
    }

    /// Brightness must change smoothly with loudness. The old bit-trick log
    /// had slope jumps every doubling, which showed up as contour rings.
    #[test]
    fn gain_mapping_has_no_slope_jumps() {
        let fft_size = 1024;
        let gain = 1.0;
        // Magnitudes spaced evenly in log, over about 100 dB.
        let mags: Vec<f32> = (0..2000).map(|i| 10f32.powf(i as f32 * 0.0025)).collect();
        let mut mapped = mags.clone();
        core::apply_gain_mapping(&mut mapped, fft_size, gain);
        let scale_factor = 9.0 / (2.0 * fft_size as f32).sqrt();
        for (m, v) in mags.iter().zip(&mapped) {
            let exact = (m * scale_factor + 1.0).log10() * gain;
            assert!((v - exact).abs() < 1e-5, "{m}: {v} vs {exact}");
        }
        // Slope against log-magnitude only ever changes gradually.
        let slopes: Vec<f32> = mapped.windows(2).map(|w| w[1] - w[0]).collect();
        for pair in slopes.windows(2) {
            if pair[0] > 1e-4 {
                let ratio = pair[1] / pair[0];
                assert!((0.9..1.1).contains(&ratio), "slope jump: {ratio}");
            }
        }
    }

    #[test]
    fn mel_formula() {
        // 按定义 1000 Hz ≈ 1000 mel。
        assert!((core::hz_to_mel(1000.0) - 1000.0).abs() < 0.1);
        for freq in [0.0, 60.0, 440.0, 1000.0, 8000.0, 20000.0] {
            let round_trip = core::mel_to_hz(core::hz_to_mel(freq));
            assert!(
                (round_trip - freq).abs() <= freq * 1e-4 + 1e-3,
                "{freq} -> {round_trip}"
            );
        }
    }

    #[test]
    fn scaled_row_edges_span_bottom_to_top_monotonically() {
        let top_freq = 20015.625;
        for (scale, bottom_freq) in [(FrequencyScale::Log, 60.0), (FrequencyScale::Mel, 0.0)] {
            for img_height in [1, 97, 256, 1024] {
                let (bottom_low, _) = scale.row_freq_edges(0, img_height, top_freq);
                let (_, top_high) = scale.row_freq_edges(img_height - 1, img_height, top_freq);
                assert!(
                    (bottom_low - bottom_freq).abs() < 1e-3,
                    "{scale:?}: {bottom_low}"
                );
                assert!(
                    (top_high - top_freq).abs() < top_freq * 1e-4,
                    "{scale:?}: {top_high}"
                );

                let mut previous_high = bottom_low;
                for y in 0..img_height {
                    let (low, high) = scale.row_freq_edges(y, img_height, top_freq);
                    assert!(high > low, "{scale:?} row {y}: {low}..{high}");
                    assert!(
                        (low - previous_high).abs() <= high * 1e-5,
                        "{scale:?} gap at {y}"
                    );
                    previous_high = high;
                }
            }
        }
        // 对数刻度：每行跨越的频率比例相同。
        let (low, high) = FrequencyScale::Log.row_freq_edges(0, 100, top_freq);
        let (low2, high2) = FrequencyScale::Log.row_freq_edges(50, 100, top_freq);
        assert!((high / low - high2 / low2).abs() < 1e-4);
    }

    #[test]
    fn linear_row_mapping_spans_bin_one_to_top_monotonically() {
        let num_freq_bins = 427;
        for log_ratio in [0.0, 0.3, 1.0] {
            let spans: Vec<_> = (0..IMG_HEIGHT)
                .map(|y| {
                    core::row_span(
                        y,
                        IMG_HEIGHT,
                        num_freq_bins,
                        46.875,
                        FrequencyScale::Linear,
                        log_ratio,
                    )
                })
                .collect();
            let RowSpan::Max { start: first, .. } = spans[0] else {
                panic!("linear rows always take a max");
            };
            let RowSpan::Max { end: last, .. } = spans[IMG_HEIGHT - 1] else {
                panic!("linear rows always take a max");
            };
            assert_eq!(first, 1, "linear skips the DC bin");
            assert_eq!(last, num_freq_bins);
            let starts: Vec<usize> = spans
                .iter()
                .map(|span| match span {
                    RowSpan::Max { start, .. } => *start,
                    _ => unreachable!(),
                })
                .collect();
            assert!(starts.windows(2).all(|w| w[0] <= w[1]));
        }
    }

    #[test]
    fn scaled_rows_interpolate_low_end_and_cover_each_high_bin_once() {
        let num_freq_bins = 427;
        let resolution = SAMPLE_RATE as f32 / FFT_SIZE as f32;
        for scale in [FrequencyScale::Log, FrequencyScale::Mel] {
            for img_height in [1, 7, 256, 512, 4096] {
                let spans: Vec<_> = (0..img_height)
                    .map(|y| core::row_span(y, img_height, num_freq_bins, resolution, scale, 0.0))
                    .collect();
                // 插值行都在下方，取最大值的行都在上方。
                let first_max = spans
                    .iter()
                    .position(|span| matches!(span, RowSpan::Max { .. }))
                    .unwrap_or(img_height);
                let mut next_bin = None;
                for (y, span) in spans.iter().enumerate() {
                    match *span {
                        RowSpan::Lerp { lower, upper, t } => {
                            assert!(
                                y < first_max,
                                "{scale:?} h={img_height}: lerp above max at {y}"
                            );
                            assert!(
                                upper < num_freq_bins && lower <= upper && (0.0..=1.0).contains(&t)
                            );
                        }
                        RowSpan::Max { start, end } => {
                            assert!(start < end && end <= num_freq_bins);
                            if let Some(expected) = next_bin {
                                assert_eq!(start, expected, "{scale:?} h={img_height} row {y}");
                            }
                            next_bin = Some(end);
                        }
                        RowSpan::Blank => panic!("unexpected blank row"),
                    }
                }
                if next_bin.is_some() {
                    assert_eq!(next_bin, Some(num_freq_bins), "{scale:?} h={img_height}");
                }
            }
        }
        // 极低采样率（顶部频率低于 60 Hz）也不能越界或出现 NaN。
        for scale in [FrequencyScale::Log, FrequencyScale::Mel] {
            for y in 0..16 {
                match core::row_span(y, 16, 512, 100.0 / 1024.0, scale, 0.0) {
                    RowSpan::Lerp { lower, upper, t } => {
                        assert!(upper < 512 && lower <= upper && t.is_finite());
                    }
                    RowSpan::Max { start, end } => assert!(start < end && end <= 512),
                    RowSpan::Blank => {}
                }
            }
        }
    }

    #[test]
    fn linear_output_matches_pre_change_renderer() {
        let palette = grey_palette();
        for (freq, img_height) in [(440.0, IMG_HEIGHT), (1000.0, 512), (3000.0, 97)] {
            let audio = generate_tone(freq);
            let spectrogram =
                core::process_audio_to_spectrogram(&audio, SAMPLE_RATE, FFT_SIZE, HOP_LENGTH, GAIN)
                    .unwrap();
            let log_ratio = core::calculate_log_ratio(
                SAMPLE_RATE,
                FFT_SIZE,
                img_height,
                spectrogram.num_freq_bins,
            );
            for ratio in [log_ratio, 0.0, 1.0] {
                let expected =
                    reference_linear_render(&spectrogram, IMG_WIDTH, img_height, ratio, &palette);
                let actual = core::render_pixels(
                    &spectrogram,
                    IMG_WIDTH,
                    img_height,
                    FrequencyScale::Linear,
                    ratio,
                    &palette,
                );
                assert!(
                    expected == actual,
                    "linear output changed: {freq} Hz, h={img_height}, ratio={ratio}"
                );
            }

            let via_api = native_api::generate_spectrogram_image_native(
                &audio,
                &palette,
                config(img_height, GAIN, FrequencyScale::Linear),
            )
            .unwrap();
            let expected =
                reference_linear_render(&spectrogram, IMG_WIDTH, img_height, log_ratio, &palette);
            assert!(via_api == expected);
        }
    }

    /// 图像某一列从下到上（0 = 底部）每行的灰度值。
    fn column_levels(pixels: &[u8], img_height: usize, x: usize) -> Vec<u8> {
        (0..img_height)
            .map(|y_logical| {
                let y_pixel = img_height - 1 - y_logical;
                pixels[(y_pixel * IMG_WIDTH + x) * 4]
            })
            .collect()
    }

    #[test]
    fn log_scale_puts_1khz_tone_on_its_mapped_row() {
        let img_height = 512;
        let tone = 1000.0;
        // 低增益，避免峰值附近的行都饱和成 255。
        let pixels = native_api::generate_spectrogram_image_native(
            &generate_tone(tone),
            &grey_palette(),
            config(img_height, 0.5, FrequencyScale::Log),
        )
        .unwrap();
        let levels = column_levels(&pixels, img_height, IMG_WIDTH / 2);
        let brightest = *levels.iter().max().unwrap();
        assert!(brightest < 255, "peak saturated, lower the gain");
        let bright_rows: Vec<usize> = (0..img_height)
            .filter(|&y| levels[y] == brightest)
            .collect();
        let peak_row = bright_rows[bright_rows.len() / 2];

        let resolution = SAMPLE_RATE as f32 / FFT_SIZE as f32;
        let top_freq = 427.0 * resolution;
        let expected_row = (0..img_height)
            .find(|&y| {
                FrequencyScale::Log
                    .row_freq_edges(y, img_height, top_freq)
                    .1
                    > tone
            })
            .unwrap();
        // 1 kHz 落在频点 21.33 上，FFT 能分辨的峰值就是最近的频点中心（984 Hz），
        // 因此允许半个频点的误差。
        let (low, high) = FrequencyScale::Log.row_freq_edges(peak_row, img_height, top_freq);
        let peak_freq = f32::midpoint(low, high);
        assert!(
            (peak_freq - tone).abs() <= resolution / 2.0,
            "peak row {peak_row} ({peak_freq:.1} Hz), log mapping puts 1 kHz on row {expected_row}"
        );
        assert!(
            peak_row.abs_diff(expected_row) <= 3,
            "{peak_row} vs {expected_row}"
        );
        // 对数刻度下 1 kHz 在图像中部附近（线性下会在约 5% 高度处）。
        assert!(expected_row > img_height / 3);
    }
}
