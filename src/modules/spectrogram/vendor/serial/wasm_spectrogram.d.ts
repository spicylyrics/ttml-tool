/* tslint:disable */
/* eslint-disable */

export class SpectrogramConfig {
    free(): void;
    [Symbol.dispose](): void;
    constructor(sample_rate: number, fft_size: number, hop_length: number, img_width: number, img_height: number, gain: number, frequency_scale: number, max_freq: number);
    fft_size: number;
    /**
     * 0 = linear，1 = log，2 = mel。
     */
    frequency_scale: number;
    gain: number;
    hop_length: number;
    img_height: number;
    img_width: number;
    /**
     * Wanted top of the image in Hz (clamped to 20 kHz and Nyquist).
     */
    max_freq: number;
    sample_rate: number;
}

export function generate_spectrogram_image(audio_data: Float32Array | number[], palette: Uint8Array | number[], config: SpectrogramConfig): Uint8Array;

export type InitInput = RequestInfo | URL | Response | BufferSource | WebAssembly.Module;

export interface InitOutput {
    readonly memory: WebAssembly.Memory;
    readonly __wbg_get_spectrogramconfig_fft_size: (a: number) => number;
    readonly __wbg_get_spectrogramconfig_frequency_scale: (a: number) => number;
    readonly __wbg_get_spectrogramconfig_gain: (a: number) => number;
    readonly __wbg_get_spectrogramconfig_hop_length: (a: number) => number;
    readonly __wbg_get_spectrogramconfig_img_height: (a: number) => number;
    readonly __wbg_get_spectrogramconfig_img_width: (a: number) => number;
    readonly __wbg_get_spectrogramconfig_max_freq: (a: number) => number;
    readonly __wbg_get_spectrogramconfig_sample_rate: (a: number) => number;
    readonly __wbg_set_spectrogramconfig_fft_size: (a: number, b: number) => void;
    readonly __wbg_set_spectrogramconfig_frequency_scale: (a: number, b: number) => void;
    readonly __wbg_set_spectrogramconfig_gain: (a: number, b: number) => void;
    readonly __wbg_set_spectrogramconfig_hop_length: (a: number, b: number) => void;
    readonly __wbg_set_spectrogramconfig_img_height: (a: number, b: number) => void;
    readonly __wbg_set_spectrogramconfig_img_width: (a: number, b: number) => void;
    readonly __wbg_set_spectrogramconfig_max_freq: (a: number, b: number) => void;
    readonly __wbg_set_spectrogramconfig_sample_rate: (a: number, b: number) => void;
    readonly __wbg_spectrogramconfig_free: (a: number, b: number) => void;
    readonly generate_spectrogram_image: (a: number, b: number, c: number, d: number, e: number) => [number, number, number, number];
    readonly spectrogramconfig_new: (a: number, b: number, c: number, d: number, e: number, f: number, g: number, h: number) => number;
    readonly __wbindgen_externrefs: WebAssembly.Table;
    readonly __wbindgen_malloc: (a: number, b: number) => number;
    readonly __wbindgen_free: (a: number, b: number, c: number) => void;
    readonly __externref_table_dealloc: (a: number) => void;
    readonly __wbindgen_start: () => void;
}

export type SyncInitInput = BufferSource | WebAssembly.Module;

/**
 * Instantiates the given `module`, which can either be bytes or
 * a precompiled `WebAssembly.Module`.
 *
 * @param {{ module: SyncInitInput }} module - Passing `SyncInitInput` directly is deprecated.
 *
 * @returns {InitOutput}
 */
export function initSync(module: { module: SyncInitInput } | SyncInitInput): InitOutput;

/**
 * If `module_or_path` is {RequestInfo} or {URL}, makes a request and
 * for everything else, calls `WebAssembly.instantiate` directly.
 *
 * @param {{ module_or_path: InitInput | Promise<InitInput> }} module_or_path - Passing `InitInput` directly is deprecated.
 *
 * @returns {Promise<InitOutput>}
 */
export default function __wbg_init (module_or_path?: { module_or_path: InitInput | Promise<InitInput> } | InitInput | Promise<InitInput>): Promise<InitOutput>;
