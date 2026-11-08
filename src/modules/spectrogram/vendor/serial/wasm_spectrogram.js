/* @ts-self-types="./wasm_spectrogram.d.ts" */

export class SpectrogramConfig {
    __destroy_into_raw() {
        const ptr = this.__wbg_ptr;
        this.__wbg_ptr = 0;
        SpectrogramConfigFinalization.unregister(this);
        return ptr;
    }
    free() {
        const ptr = this.__destroy_into_raw();
        wasm.__wbg_spectrogramconfig_free(ptr, 0);
    }
    /**
     * @returns {number}
     */
    get fft_size() {
        const ret = wasm.__wbg_get_spectrogramconfig_fft_size(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * 0 = linear，1 = log，2 = mel。
     * @returns {number}
     */
    get frequency_scale() {
        const ret = wasm.__wbg_get_spectrogramconfig_frequency_scale(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get gain() {
        const ret = wasm.__wbg_get_spectrogramconfig_gain(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get hop_length() {
        const ret = wasm.__wbg_get_spectrogramconfig_hop_length(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get img_height() {
        const ret = wasm.__wbg_get_spectrogramconfig_img_height(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @returns {number}
     */
    get img_width() {
        const ret = wasm.__wbg_get_spectrogramconfig_img_width(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * Wanted top of the image in Hz (clamped to 20 kHz and Nyquist).
     * @returns {number}
     */
    get max_freq() {
        const ret = wasm.__wbg_get_spectrogramconfig_max_freq(this.__wbg_ptr);
        return ret;
    }
    /**
     * @returns {number}
     */
    get sample_rate() {
        const ret = wasm.__wbg_get_spectrogramconfig_sample_rate(this.__wbg_ptr);
        return ret >>> 0;
    }
    /**
     * @param {number} arg0
     */
    set fft_size(arg0) {
        wasm.__wbg_set_spectrogramconfig_fft_size(this.__wbg_ptr, arg0);
    }
    /**
     * 0 = linear，1 = log，2 = mel。
     * @param {number} arg0
     */
    set frequency_scale(arg0) {
        wasm.__wbg_set_spectrogramconfig_frequency_scale(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set gain(arg0) {
        wasm.__wbg_set_spectrogramconfig_gain(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set hop_length(arg0) {
        wasm.__wbg_set_spectrogramconfig_hop_length(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set img_height(arg0) {
        wasm.__wbg_set_spectrogramconfig_img_height(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set img_width(arg0) {
        wasm.__wbg_set_spectrogramconfig_img_width(this.__wbg_ptr, arg0);
    }
    /**
     * Wanted top of the image in Hz (clamped to 20 kHz and Nyquist).
     * @param {number} arg0
     */
    set max_freq(arg0) {
        wasm.__wbg_set_spectrogramconfig_max_freq(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} arg0
     */
    set sample_rate(arg0) {
        wasm.__wbg_set_spectrogramconfig_sample_rate(this.__wbg_ptr, arg0);
    }
    /**
     * @param {number} sample_rate
     * @param {number} fft_size
     * @param {number} hop_length
     * @param {number} img_width
     * @param {number} img_height
     * @param {number} gain
     * @param {number} frequency_scale
     * @param {number} max_freq
     */
    constructor(sample_rate, fft_size, hop_length, img_width, img_height, gain, frequency_scale, max_freq) {
        const ret = wasm.spectrogramconfig_new(sample_rate, fft_size, hop_length, img_width, img_height, gain, frequency_scale, max_freq);
        this.__wbg_ptr = ret;
        SpectrogramConfigFinalization.register(this, this.__wbg_ptr, this);
        return this;
    }
}
if (Symbol.dispose) SpectrogramConfig.prototype[Symbol.dispose] = SpectrogramConfig.prototype.free;

/**
 * @param {Float32Array | number[]} audio_data
 * @param {Uint8Array | number[]} palette
 * @param {SpectrogramConfig} config
 * @returns {Uint8Array}
 */
export function generate_spectrogram_image(audio_data, palette, config) {
    _assertClass(config, SpectrogramConfig);
    let ptr0, len0, ptr1, len1;
    try {
        ptr0 = passArrayF32ToWasm0(audio_data, wasm.__wbindgen_malloc);
        len0 = WASM_VECTOR_LEN;
        ptr1 = passArray8ToWasm0(palette, wasm.__wbindgen_malloc);
        len1 = WASM_VECTOR_LEN;
    } catch (e) {
        if (ptr1) { wasm.__wbindgen_free(ptr1, len1 * 1, 1); }
        if (ptr0) { wasm.__wbindgen_free(ptr0, len0 * 4, 4); }
        throw e;
    }
    const ret = wasm.generate_spectrogram_image(ptr0, len0, ptr1, len1, config.__wbg_ptr);
    if (ret[3]) {
        throw takeFromExternrefTable0(ret[2]);
    }
    var v3 = getArrayU8FromWasm0(ret[0], ret[1]).slice();
    wasm.__wbindgen_free(ret[0], ret[1] * 1, 1);
    return v3;
}
function __wbg_get_imports() {
    const import0 = {
        __proto__: null,
        __wbg___wbindgen_throw_4c88d8bf264fd984: function(arg0, arg1) {
            throw new Error(getStringFromWasm0(arg0, arg1));
        },
        __wbg_new_787b9fb330d55d78: function(arg0, arg1) {
            const ret = new Error(getStringFromWasm0(arg0, arg1));
            return ret;
        },
        __wbindgen_init_externref_table: function() {
            const table = wasm.__wbindgen_externrefs;
            table.set(0, undefined);
            table.set(1024, undefined);
            table.set(1025, null);
            table.set(1026, true);
            table.set(1027, false);
        },
    };
    return {
        __proto__: null,
        "./wasm_spectrogram_bg.js": import0,
    };
}

const SpectrogramConfigFinalization = (typeof FinalizationRegistry === 'undefined')
    ? { register: () => {}, unregister: () => {} }
    : new FinalizationRegistry(ptr => wasm.__wbg_spectrogramconfig_free(ptr, 1));

function _assertClass(instance, klass) {
    if (!(instance instanceof klass)) {
        throw new Error(`expected instance of ${klass.name}`);
    }
}

function getArrayU8FromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return getUint8ArrayMemory0().subarray(ptr / 1, ptr / 1 + len);
}

let cachedFloat32ArrayMemory0 = null;
function getFloat32ArrayMemory0() {
    if (cachedFloat32ArrayMemory0 === null || cachedFloat32ArrayMemory0.byteLength === 0) {
        cachedFloat32ArrayMemory0 = new Float32Array(wasm.memory.buffer);
    }
    return cachedFloat32ArrayMemory0;
}

function getStringFromWasm0(ptr, len) {
    ptr = ptr >>> 0;
    return decodeText(getUint8ArrayMemory0().subarray(ptr, ptr + len));
}

let cachedUint8ArrayMemory0 = null;
function getUint8ArrayMemory0() {
    if (cachedUint8ArrayMemory0 === null || cachedUint8ArrayMemory0.byteLength === 0) {
        cachedUint8ArrayMemory0 = new Uint8Array(wasm.memory.buffer);
    }
    return cachedUint8ArrayMemory0;
}

function passArray8ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 1, 1) >>> 0;
    getUint8ArrayMemory0().set(arg, ptr / 1);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function passArrayF32ToWasm0(arg, malloc) {
    const ptr = malloc(arg.length * 4, 4) >>> 0;
    getFloat32ArrayMemory0().set(arg, ptr / 4);
    WASM_VECTOR_LEN = arg.length;
    return ptr;
}

function takeFromExternrefTable0(idx) {
    const value = wasm.__wbindgen_externrefs.get(idx);
    wasm.__externref_table_dealloc(idx);
    return value;
}

let cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
cachedTextDecoder.decode();
const MAX_SAFARI_DECODE_BYTES = 2146435072;
let numBytesDecoded = 0;
function decodeText(bytes) {
    numBytesDecoded += bytes.length;
    if (numBytesDecoded >= MAX_SAFARI_DECODE_BYTES) {
        cachedTextDecoder = new TextDecoder('utf-8', { ignoreBOM: true });
        cachedTextDecoder.decode();
        numBytesDecoded = bytes.length;
    }
    return cachedTextDecoder.decode(bytes);
}

let WASM_VECTOR_LEN = 0;

let wasmModule, wasmInstance, wasm;
function __wbg_finalize_init(instance, module) {
    wasmInstance = instance;
    wasm = instance.exports;
    wasmModule = module;
    cachedFloat32ArrayMemory0 = null;
    cachedUint8ArrayMemory0 = null;
    wasm.__wbindgen_start();
    return wasm;
}

async function __wbg_load(module, imports) {
    if (typeof Response === 'function' && module instanceof Response) {
        if (!module.ok) {
            throw new Error(`failed to fetch Wasm: ${module.status} ${module.statusText} fetching '${module.url}'`);
        }

        if (typeof WebAssembly.instantiateStreaming === 'function') {
            try {
                return await WebAssembly.instantiateStreaming(module, imports);
            } catch (e) {
                const validResponse = expectedResponseType(module.type);

                if (validResponse && module.headers.get('Content-Type') !== 'application/wasm') {
                    console.warn("`WebAssembly.instantiateStreaming` failed because your server does not serve Wasm with `application/wasm` MIME type. Falling back to `WebAssembly.instantiate` which is slower. Original error:\n", e);

                } else { throw e; }
            }
        }

        const bytes = await module.arrayBuffer();
        return await WebAssembly.instantiate(bytes, imports);
    } else {
        const instance = await WebAssembly.instantiate(module, imports);

        if (instance instanceof WebAssembly.Instance) {
            return { instance, module };
        } else {
            return instance;
        }
    }

    function expectedResponseType(type) {
        switch (type) {
            case 'basic': case 'cors': case 'default': return true;
        }
        return false;
    }
}

function initSync(module) {
    if (wasm !== undefined) return wasm;


    if (module !== undefined) {
        if (Object.getPrototypeOf(module) === Object.prototype) {
            ({module} = module)
        } else {
            console.warn('using deprecated parameters for `initSync()`; pass a single object instead')
        }
    }

    const imports = __wbg_get_imports();
    if (!(module instanceof WebAssembly.Module)) {
        module = new WebAssembly.Module(module);
    }
    const instance = new WebAssembly.Instance(module, imports);
    return __wbg_finalize_init(instance, module);
}

let __wbg_init_promise;
async function __wbg_init(module_or_path) {
    if (wasm !== undefined) return wasm;
    if (__wbg_init_promise === undefined) {
        __wbg_init_promise = __wbg_init_once(module_or_path);
        __wbg_init_promise.catch(() => { __wbg_init_promise = undefined; });
    }
    return __wbg_init_promise;
}

async function __wbg_init_once(module_or_path) {

    if (module_or_path !== undefined) {
        if (Object.getPrototypeOf(module_or_path) === Object.prototype) {
            ({module_or_path} = module_or_path)
        } else {
            console.warn('using deprecated parameters for the initialization function; pass a single object instead')
        }
    }

    if (module_or_path === undefined) {
        module_or_path = new URL('wasm_spectrogram_bg.wasm', import.meta.url);
    }
    const imports = __wbg_get_imports();

    if (typeof module_or_path === 'string' || (typeof Request === 'function' && module_or_path instanceof Request) || (typeof URL === 'function' && module_or_path instanceof URL)) {
        module_or_path = fetch(module_or_path);
    }

    const { instance, module } = await __wbg_load(await module_or_path, imports);

    return __wbg_finalize_init(instance, module);
}

export { initSync, __wbg_init as default };
